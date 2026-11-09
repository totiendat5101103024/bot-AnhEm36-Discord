/**
 * YtDlpExtractorPlugin.js
 *
 * Custom ExtractorPlugin (type="extractor") dùng yt-dlp + Spotify embed scraping:
 *
 * Luồng xử lý:
 *   Spotify URL  → scrape embed page → lấy title + artist → ytsearch YouTube → play
 *   YouTube URL  → yt-dlp --dump-json → Song → play
 *   Text search  → yt-dlp ytsearch1: → Song → play
 *
 * Không cần credentials Spotify, không cần @distube/spotify, @distube/youtube, @distube/ytsr.
 *
 * Tính năng v2:
 *   - Prefetch: chủ động lấy stream URL cho bài tiếp theo trong queue
 *   - Cache stream URL với TTL 45 phút (tối đa 100 entry)
 *   - Auto re-resolve khi URL hết hạn (403/expired)
 *
 * v3:
 *   - Warm-up stream URL: chờ googlevideo trả 200/206 trước khi đưa cho ffmpeg
 *     (fix lỗi "ffmpeg exited with code 8" do HTTP 403 ngay sau khi URL được sinh ra)
 *   - Không dùng URL lúc resolve: luôn lấy URL tươi qua getStreamURL() trước khi phát
 */

'use strict';

const { ExtractorPlugin, Song, Playlist, DisTubeError } = require('distube');
const { execFile } = require('child_process');
const path = require('path');

// Binary yt-dlp được @distube/yt-dlp quản lý và tự update
const YTDLP_BIN = process.env.YTDLP_PATH
    || path.join(__dirname, '..', 'node_modules', '@distube', 'yt-dlp', 'bin', 'yt-dlp');

// ─────────────────────────────────────────────────────────────
// Stream URL Cache — giảm khoảng trễ giữa 2 bài
// ─────────────────────────────────────────────────────────────

// Map<songCacheKey, { url: string, timestamp: number }>
const streamCache = new Map();
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 phút — URL YouTube thường sống vài giờ
const CACHE_MAX_ENTRIES = 100;

// Map<key, Promise<string>> — tránh 2 lần resolve cùng một bài
const inFlight = new Map();

// ─────────────────────────────────────────────────────────────
// Warm-up stream URL
// ─────────────────────────────────────────────────────────────
// YouTube (googlevideo) trả về HTTP 403 trong khoảng 1–3 giây đầu tiên
// sau khi URL vừa được yt-dlp sinh ra. Nếu ffmpeg truy cập ngay lập tức
// nó sẽ nhận 403 và thoát với code 8 → DisTube báo
// "ffmpeg exited with code 8".
//
// Giải pháp: chủ động "đánh thức" URL bằng 1 request Range nhỏ và chờ
// cho tới khi nhận 200/206 trước khi trả URL cho ffmpeg.
const STREAM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
// Giảm mạnh so với bản cũ: trước đây có thể chặn tới ~110 giây/bài.
// Nếu 4 lần vẫn fail, để ffmpeg/DisTube tự retry thay vì treo hàng đợi.
const WARMUP_ATTEMPTS = 4;       // tối đa ~13 giây
const WARMUP_DELAY_MS = 300;
const WARMUP_TIMEOUT_MS = 3000;

async function warmUpStreamURL(url) {
    let lastStatus = null;

    for (let attempt = 1; attempt <= WARMUP_ATTEMPTS; attempt++) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': STREAM_UA,
                    'Accept': '*/*',
                    // Chỉ tải 2 byte để không tốn băng thông
                    'Range': 'bytes=0-1',
                },
                signal: AbortSignal.timeout(WARMUP_TIMEOUT_MS),
            });

            lastStatus = res.status;
            await res.body?.cancel();

            if (res.ok || res.status === 206) {
                if (attempt > 1) {
                    console.log(`[Warmup] ✅ URL sẵn sàng sau ${attempt} lần thử (${(attempt - 1) * WARMUP_DELAY_MS}ms)`);
                }
                return url;
            }
        } catch (e) {
            lastStatus = e.message;
        }

        if (attempt < WARMUP_ATTEMPTS) {
            await new Promise(r => setTimeout(r, WARMUP_DELAY_MS));
        }
    }

    // Không warm-up được → báo lỗi để getStreamURL thử lấy URL mới
    throw new Error(`Stream URL not ready after warm-up (last status: ${lastStatus})`);
}

/**
 * Tạo cache key cho 1 bài hát (dùng url hoặc _searchQuery)
 */
function getCacheKey(song) {
    return song._searchQuery || song.url || song.id || song.name;
}

/**
 * Lấy stream URL từ cache nếu chưa hết hạn
 */
function getCachedStream(song) {
    const key = getCacheKey(song);
    const entry = streamCache.get(key);
    if (entry && (Date.now() - entry.timestamp) < CACHE_TTL_MS) {
        return entry.url;
    }
    // Xoá entry hết hạn
    if (entry) streamCache.delete(key);
    return null;
}

/**
 * Lưu stream URL vào cache
 */
function setCachedStream(song, url) {
    const key = getCacheKey(song);
    streamCache.set(key, { url, timestamp: Date.now() });
    // Giới hạn cache để tránh memory leak
    while (streamCache.size > CACHE_MAX_ENTRIES) {
        const oldest = streamCache.keys().next().value;
        streamCache.delete(oldest);
    }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Chạy yt-dlp và trả về mảng JSON objects (mỗi item là 1 video)
 */
function runYtDlp(args, timeout = 30000) {
    return new Promise((resolve, reject) => {
        execFile(YTDLP_BIN, args, { timeout }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr?.trim() || error.message));
                return;
            }
            try {
                const lines = stdout.trim().split('\n').filter(l => l.startsWith('{'));
                if (lines.length === 0) throw new Error('No JSON output');
                resolve(lines.map(l => JSON.parse(l)));
            } catch (e) {
                reject(new Error('Failed to parse yt-dlp output: ' + e.message));
            }
        });
    });
}

/**
 * Chuyển raw yt-dlp JSON → DisTube Song info
 */
function toSongInfo(plugin, info) {
    return {
        plugin,
        source: info.extractor_key?.toLowerCase() || 'youtube',
        playFromSource: true,
        id: info.id,
        name: info.title,
        isLive: !!info.is_live,
        duration: info.duration || 0,
        url: info.webpage_url || info.original_url || info.url,
        thumbnail: info.thumbnail,
        views: info.view_count,
        uploader: {
            name: info.uploader || info.channel || 'Unknown',
            url:  info.uploader_url || info.channel_url,
        },
        ageRestricted: (info.age_limit || 0) > 0,
        // KHÔNG gán stream.url ở đây!
        // URL mà yt-dlp trả về lúc resolve chỉ "sống" sau ~1-3 giây, nếu ffmpeg
        // dùng ngay sẽ bị 403 → "ffmpeg exited with code 8".
        // Để trống → DisTube sẽ gọi getStreamURL() ngay trước khi phát,
        // nơi URL được lấy mới + warm-up + cache.
        stream: {
            playFromSource: true,
        },
    };
}

// ─────────────────────────────────────────────────────────────
// Spotify helpers (không cần credentials)
// ─────────────────────────────────────────────────────────────

const SPOTIFY_URL_RE = /open\.spotify\.com\/(track|album|playlist|artist)\/([A-Za-z0-9]+)/;

function getSpotifyType(url) {
    const m = url.match(SPOTIFY_URL_RE);
    return m ? { type: m[1], id: m[2] } : null;
}

/**
 * Scrape Spotify embed page để lấy thông tin track.
 * Dùng __NEXT_DATA__ JSON được embed sẵn trong HTML — không cần auth.
 */
async function scrapeSpotifyTrack(trackId) {
    const embedUrl = `https://open.spotify.com/embed/track/${trackId}`;
    const res = await fetch(embedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/1.0)' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Spotify embed HTTP ${res.status}`);

    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
    if (!m) throw new Error('Cannot find __NEXT_DATA__ in Spotify embed');

    const data = JSON.parse(m[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;
    if (!entity) throw new Error('Cannot find entity in Spotify __NEXT_DATA__');

    const title = entity.name;
    const rawArtists = entity.artists;
    let artists = [];
    if (Array.isArray(rawArtists)) {
        artists = rawArtists
            .filter(a => typeof a === 'object' && a !== null)
            .map(a => a.name || a.profile?.name)
            .filter(Boolean);
    } else if (rawArtists?.items) {
        artists = rawArtists.items.map(a => a.profile?.name).filter(Boolean);
    }

    const duration = entity.duration?.totalMilliseconds
        ? Math.floor(entity.duration.totalMilliseconds / 1000)
        : 0;

    const thumbnail = entity.coverArt?.sources?.[0]?.url || null;

    return { title, artists, duration, thumbnail, id: trackId };
}

/**
 * Scrape Spotify embed page để lấy danh sách tracks của playlist/album.
 * Trả về array { title, subtitle (artist string), duration_ms, thumbnail, id }
 *
 * Lưu ý cấu trúc embed playlist khác track:
 *   - URL phải có ?utm_source=oembed
 *   - trackList items dùng: { title, subtitle, duration (ms int), uri }
 *   - 'subtitle' = chuỗi nghệ sĩ (VD: "Olivia Dean", "Katrina & The Waves")
 */
async function scrapeSpotifyPlaylist(type, id) {
    // QUAN TRỌNG: Phải thêm ?utm_source=oembed vào URL mới lấy được data
    const embedUrl = `https://open.spotify.com/embed/${type}/${id}?utm_source=oembed`;
    const res = await fetch(embedUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Spotify embed HTTP ${res.status}`);

    const html = await res.text();
    const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s);
    if (!m) throw new Error('Cannot find __NEXT_DATA__ in Spotify embed');

    const data = JSON.parse(m[1]);

    // Kiểm tra nếu trang trả về 404 (playlist đặc biệt như Spotify Radio không embed được)
    const pageStatus = data?.props?.pageProps?.status;
    if (pageStatus === 404) {
        throw new Error('PLAYLIST_NOT_EMBEDDABLE');
    }

    const entity = data?.props?.pageProps?.state?.data?.entity;
    if (!entity) throw new Error('No entity found in Spotify embed data');

    const playlistName = entity.name || entity.title || `Spotify ${type}`;
    const thumbnail = entity.coverArt?.sources?.[0]?.url || null;

    // trackList items trong playlist embed có cấu trúc:
    // { uri: 'spotify:track:ID', title: 'Song Name', subtitle: 'Artist Name', duration: 184000 }
    const trackItems = entity.trackList || [];
    if (!trackItems.length) throw new Error('Playlist is empty or has no accessible tracks');

    const tracks = trackItems
        .filter(t => t.uri && t.title) // lọc bỏ items không hợp lệ
        .slice(0, 50)
        .map(item => ({
            title: item.title,
            subtitle: item.subtitle || '',   // subtitle = artist string
            duration: typeof item.duration === 'number'
                ? Math.floor(item.duration / 1000)
                : 0,
            thumbnail,
            id: item.uri.split(':').pop(),
        }));

    return { playlistName, tracks };
}

// ─────────────────────────────────────────────────────────────
// Plugin chính
// ─────────────────────────────────────────────────────────────

class YtDlpExtractorPlugin extends ExtractorPlugin {
    constructor() {
        super();
    }

    /** Nhận tất cả URL và search query */
    validate() {
        return true;
    }

    /**
     * resolve() — xử lý URL trực tiếp.
     * Được gọi khi DisTube phát hiện input là URL.
     */
    async resolve(url, options) {
        const spotify = getSpotifyType(url);
        if (spotify) {
            return this._resolveSpotify(spotify.type, spotify.id, url, options);
        }

        // URL thông thường (YouTube, SoundCloud, v.v.) → dùng yt-dlp
        return this._resolveYtDlp(url, options);
    }

    /** Xử lý Spotify URL bằng cách scrape embed → search YouTube */
    async _resolveSpotify(type, id, originalUrl, options) {
        try {
            if (type === 'track') {
                const info = await scrapeSpotifyTrack(id);
                const query = `${info.title} ${info.artists.join(' ')}`;
                console.log(`[YtDlpExtractorPlugin] Spotify → searching YouTube: "${query}"`);

                const song = await this.searchSong(query, options);
                if (!song) throw new Error(`YouTube search returned no results for "${query}"`);

                // Giữ thumbnail Spotify nếu đẹp hơn
                if (info.thumbnail && !song.thumbnail) song.thumbnail = info.thumbnail;
                return song;
            }

            if (type === 'album' || type === 'playlist') {
                let playlistData;
                try {
                    playlistData = await scrapeSpotifyPlaylist(type, id);
                } catch (e) {
                    if (e.message === 'PLAYLIST_NOT_EMBEDDABLE') {
                        // Spotify Radio / Curated Mix không embed được
                        // Fallback: lấy tên playlist từ oEmbed rồi search YouTube playlist
                        console.log(`[YtDlpExtractorPlugin] Playlist không embed được, thử oEmbed fallback...`);
                        const oembedRes = await fetch(
                            `https://open.spotify.com/oembed?url=https://open.spotify.com/${type}/${id}`,
                            { signal: AbortSignal.timeout(8000) }
                        );
                        if (!oembedRes.ok) {
                            throw new Error('Đây là Playlist cá nhân/Mix tự động của Spotify. Bot không thể đọc được danh sách bài hát này. Vui lòng dùng Playlist công khai hoặc tìm bằng tên!');
                        }
                        const oembed = await oembedRes.json();
                        const playlistTitle = oembed.title || 'Spotify Playlist';
                        // Search YouTube playlist theo tên
                        const song = await this.searchSong(playlistTitle, options);
                        if (!song) throw new Error(`Không tìm thấy "${playlistTitle}" trên YouTube`);
                        return song;
                    }
                    throw e;
                }

                const { playlistName, tracks } = playlistData;
                if (!tracks.length) throw new Error('Playlist trống hoặc không có bài nào');

                // Resolve bài đầu tiên đồng bộ để có thể phát ngay
                const firstQuery = `${tracks[0].title} ${tracks[0].subtitle}`.trim();
                console.log(`[YtDlpExtractorPlugin] Playlist "${playlistName}" (${tracks.length} bài) - Searching: "${firstQuery}"`);
                const firstSong = await this.searchSong(firstQuery, options);
                if (!firstSong) throw new Error(`Không tìm thấy bài đầu tiên "${tracks[0].title}" trên YouTube`);

                // Tạo Song objects cho các track còn lại (lazy search khi đến lượt)
                const songs = [firstSong];
                for (const track of tracks.slice(1)) {
                    const displayName = track.subtitle
                        ? `${track.title} - ${track.subtitle}`
                        : track.title;
                    const songInfo = {
                        plugin: this,
                        source: 'youtube', // QUAN TRỌNG: phải là 'youtube' (nguồn thật sự sẽ phát),
                                            // không phải 'spotify' — nếu không DisTube sẽ báo lỗi
                                            // "There is no plugin supporting this song" vì không có
                                            // plugin nào đăng ký xử lý phát nhạc cho nguồn 'spotify'.
                        playFromSource: true,
                        id: track.id,
                        name: displayName,
                        isLive: false,
                        duration: track.duration,
                        url: `https://open.spotify.com/track/${track.id}`, // vẫn giữ để hiển thị/tham chiếu gốc
                        thumbnail: track.thumbnail,
                        uploader: { name: track.subtitle || 'Unknown' },
                        ageRestricted: false,
                        stream: { playFromSource: true },
                        _searchQuery: `${track.title} ${track.subtitle}`.trim(),
                    };
                    songs.push(new Song(songInfo, options));
                }

                const { Playlist } = require('distube');
                return new Playlist({ source: 'spotify', id, name: playlistName, songs }, options);
            }

            throw new Error(`Unsupported Spotify type: ${type}`);
        } catch (e) {
            throw new DisTubeError('YTDLP_ERROR', `Spotify resolve failed: ${e.message}`);
        }
    }

    /** Resolve URL thông thường qua yt-dlp */
    async _resolveYtDlp(url, options) {
        try {
            const args = [
                url,
                '--dump-json',
                '--no-playlist',
                '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
                '--no-warnings',
            ];
            const infos = await runYtDlp(args);
            if (!infos?.length) throw new Error('No result');

            const song = new Song(toSongInfo(this, infos[0]), options);
            return song;
        } catch (e) {
            throw new DisTubeError('YTDLP_ERROR', `yt-dlp failed to resolve "${url}": ${e.message}`);
        }
    }

    /**
     * searchSong() — tìm kiếm YouTube và trả về bài phù hợp nhất.
     * Được gọi khi:
     *   - User gõ text thay vì URL
     *   - Spotify track được resolve thành search query
     */
    async searchSong(query, options) {
        try {
            // Nếu query là Spotify URL (edge case: DisTube gọi searchSong với URL)
            const spotify = getSpotifyType(query);
            if (spotify && spotify.type === 'track') {
                const info = await scrapeSpotifyTrack(spotify.id);
                query = `${info.title} ${info.artists.join(' ')}`;
            }

            const args = [
                `ytsearch1:${query}`,
                '--dump-json',
                '--no-playlist',
                '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
                '--no-warnings',
            ];
            const infos = await runYtDlp(args, 25000);
            if (!infos?.length) return null;

            return new Song(toSongInfo(this, infos[0]), options);
        } catch (e) {
            console.error('[YtDlpExtractorPlugin] searchSong error:', e.message);
            return null;
        }
    }

    /**
     * searchSongs() — tìm nhiều kết quả để hiển thị select menu.
     */
    async searchSongs(query, limit = 5, options = {}) {
        const n = Math.max(1, Math.min(Number(limit) || 5, 10));
        const args = [
            `ytsearch${n}:${query}`,
            '--dump-json',
            '--playlist-end', String(n),
            '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
            '--no-warnings',
        ];
        const infos = await runYtDlp(args, 30000);
        return infos.slice(0, n).map((info) => new Song(toSongInfo(this, info), options));
    }

    /**
     * prefetchStreamURL() — chủ động lấy stream URL cho 1 bài và cache lại.
     * Được gọi từ index.js khi event 'playSong' để chuẩn bị sẵn cho bài tiếp theo.
     */
    async prefetchStreamURL(song) {
        // Nếu đã có trong cache, bỏ qua
        if (getCachedStream(song)) return;

        try {
            const url = await this._fetchStreamURL(song);
            setCachedStream(song, url);
        } catch (e) {
            // Không throw — prefetch thất bại không phải lỗi nghiêm trọng
            console.log(`[Prefetch] ⚠️ Lỗi prefetch: ${e.message}`);
        }
    }

    /**
     * _fetchStreamURL() — dedupe các lần gọi trùng bài.
     */
    async _fetchStreamURL(song) {
        const key = `${getCacheKey(song)}::${song.url || ''}`;
        if (inFlight.has(key)) return inFlight.get(key);

        const promise = this._fetchStreamURLInner(song)
            .finally(() => inFlight.delete(key));
        inFlight.set(key, promise);
        return promise;
    }

    /**
     * _fetchStreamURLInner() — logic lõi lấy stream URL (không cache).
     * Được dùng bởi cả getStreamURL() và prefetchStreamURL().
     */
    async _fetchStreamURLInner(song) {
        // Nếu là bài trong Spotify playlist chưa được search → search trước
        if (song._searchQuery || (getSpotifyType(song.url) && !song.stream?.url)) {
            const query = song._searchQuery
                || (() => {
                    const s = getSpotifyType(song.url);
                    return s ? `${song.name}` : song.name;
                })();

            const ytSong = await this.searchSong(query, {});
            if (!ytSong) throw new DisTubeError('YTDLP_ERROR', `Cannot find "${query}" on YouTube`);
            return this._fetchStreamURL(ytSong);
        }

        // YouTube URL → lấy direct stream URL
        const args = [
            song.url,
            '--get-url',
            '--no-playlist',
            '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
            '--no-warnings',
        ];
        const url = await new Promise((resolve, reject) => {
            execFile(YTDLP_BIN, args, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) reject(new Error(stderr?.trim() || error.message));
                else resolve(stdout.trim().split('\n')[0]);
            });
        });

        if (!url) throw new Error('yt-dlp returned an empty stream URL');

        // Chờ URL thực sự sẵn sàng (tránh 403 ngay sau khi URL được sinh ra)
        await warmUpStreamURL(url);

        return url;
    }

    /**
     * getStreamURL() — lấy URL stream trực tiếp ngay trước khi ffmpeg phát.
     * Được gọi cho mọi bài, kể cả playlist items chưa được search.
     *
     * v2: Kiểm tra cache trước, auto re-resolve nếu URL hết hạn (403/expired).
     * v3: Warm-up URL trước khi trả về (tránh lỗi ffmpeg exit code 8 do 403).
     */
    async getStreamURL(song) {
        // Bước 1: Kiểm tra cache (từ prefetch hoặc lần gọi trước)
        const cached = getCachedStream(song);
        if (cached) {
            console.log(`[getStreamURL] ✅ Cache hit cho "${song.name}"`);
            return cached;
        }

        // Bước 2: Lấy stream URL mới
        const MAX_RETRIES = 3;
        let lastError;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const url = await this._fetchStreamURL(song);
                // Lưu vào cache cho lần sau
                setCachedStream(song, url);
                return url;
            } catch (e) {
                lastError = e;
                const msg = e.message?.toLowerCase() || '';
                // Nếu lỗi 403/expired → thử lại (có thể URL cũ đã hết hạn)
                if (attempt < MAX_RETRIES && (msg.includes('403') || msg.includes('expired') || msg.includes('http error') || msg.includes('warm-up'))) {
                    console.log(`[getStreamURL] ⚠️ URL chưa sẵn sàng cho "${song.name}", thử lại lần ${attempt + 1}...`);
                    // Xoá cache entry cũ nếu có
                    streamCache.delete(getCacheKey(song));
                    continue;
                }
            }
        }

        throw new DisTubeError('YTDLP_ERROR', `Cannot get stream URL for "${song.name}": ${lastError?.message}`);
    }
}

module.exports = { YtDlpExtractorPlugin };