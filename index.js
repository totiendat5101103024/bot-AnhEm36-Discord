require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpExtractorPlugin } = require('./plugins/YtDlpExtractorPlugin');
// Giữ lại YtDlpPlugin (để tự động update binary yt-dlp)
const { YtDlpPlugin } = require('@distube/yt-dlp');

// ─── Chẩn đoán thư viện voice ─────────────────────────────────
// Chạy 1 lần lúc startup để xác nhận thư viện opus/encryption đang thực sự dùng
// Sau khi đã xác nhận xong, có thể xoá đoạn này
const { generateDependencyReport } = require('@discordjs/voice');
console.log('═══════════════════════════════════════════');
console.log('🔍 Voice Dependency Report:');
console.log(generateDependencyReport());
console.log('═══════════════════════════════════════════');

// Khởi tạo Bot với đầy đủ các quyền tương tác
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, // Cần cho deadline reminder DM
    ] 
});

// Tạo instance plugin để có thể gọi prefetch
const ytDlpExtractor = new YtDlpExtractorPlugin();

// Cấu hình DisTube v5
client.distube = new DisTube(client, {
    plugins: [
        // Plugin duy nhất: YtDlpExtractorPlugin (type="extractor")
        // Xử lý được tất cả: search, YouTube URL, Spotify URL, SoundCloud, v.v.
        // Đây là giải pháp thay thế:
        //   - @distube/youtube (bị lỗi parseItem trong ytsr)
        //   - @distube/spotify (cần credentials + scraping bị chặn)
        ytDlpExtractor,

        // YtDlpPlugin giữ lại chỉ để tự update binary yt-dlp khi khởi động
        new YtDlpPlugin({ update: true }),
    ]
});

client.commands = new Collection();

// Tự động nạp các file lệnh trong thư mục commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
}

// ============================================================
// DisTube v5 Events — CHÚ Ý: Signature khác hoàn toàn so với v4
// ============================================================
client.distube
    // Khi bắt đầu phát một bài nhạc
    .on('playSong', (queue, song) => {
        queue.textChannel?.send(`🎵 **Đang phát:** \`${song.name}\` - \`[${song.formattedDuration}]\`\n👤 Yêu cầu bởi: ${song.user}`);

        // ─── PREFETCH: chủ động lấy stream URL cho bài tiếp theo ───
        // Giúp giảm khoảng trễ giữa 2 bài (không phải đợi yt-dlp lúc chuyển bài)
        if (queue.songs.length > 1) {
            const nextSong = queue.songs[1];
            ytDlpExtractor.prefetchStreamURL(nextSong).then(() => {
                console.log(`[Prefetch] ✅ Đã cache stream URL cho bài tiếp: "${nextSong.name}"`);
            }).catch(err => {
                // Không critical — nếu prefetch thất bại, getStreamURL sẽ tự lấy lại
                console.log(`[Prefetch] ⚠️ Không thể prefetch "${nextSong.name}": ${err.message}`);
            });
        }
    })
    // Khi thêm bài vào hàng đợi (bài đầu tiên sẽ emit addSong rồi tự gọi playSong)
    .on('addSong', (queue, song) => {
        // DisTube v5: songs[0] là bài đang/sắp phát. songs.length > 1 = bài thứ 2 trở đi.
        if (queue.songs.length > 1) {
            queue.textChannel?.send(`✅ **Đã thêm vào hàng đợi:** \`${song.name}\` (Vị trí #${queue.songs.length - 1})`);
        }
    })
    // Khi thêm playlist
    .on('addList', (queue, playlist) => {
        queue.textChannel?.send(`📥 **Đã nạp Playlist:** \`${playlist.name}\` (${playlist.songs.length} bài) vào hàng đợi!`);
    })
    // Khi hàng đợi kết thúc (hết bài)
    .on('finish', (queue) => {
        queue.textChannel?.send('✅ Hàng đợi đã phát hết. Bot tạm nghỉ!');
    })
    // Khi bot thoát kênh voice
    .on('disconnect', (queue) => {
        queue.textChannel?.send('👋 Bot đã rời kênh thoại.');
    })
    // ⚠️ QUAN TRỌNG: DisTube v5 error signature là (error, queue, song)
    // KHÔNG PHẢI (channel, error) như v4 — đây là lý do lỗi bị nuốt im lặng!
    .on('error', (error, queue, song) => {
        console.error('[DisTube ERROR]', error);
        const channel = queue?.textChannel;
        const songInfo = song ? ` khi phát \`${song.name}\`` : '';
        if (channel) {
            channel.send(`❌ **Lỗi phát nhạc${songInfo}:** ${error.message?.slice(0, 200) ?? error}`);
        }
    })
    // Debug log — giúp theo dõi luồng phát nhạc trong PM2 logs
    .on('debug', (message) => {
        console.log('[DisTube DEBUG]', message);
    });

// Tương tác lệnh gõ từ người dùng
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (!interaction.replied) {
            await interaction.reply({ content: 'Có lỗi xảy ra khi chạy lệnh này!', ephemeral: true });
        }
    }
});

// ─── Zotero Auto-Post: Polling tài liệu mới ──────────────────
// Mỗi 10 phút kiểm tra xem có tài liệu mới thêm vào thư viện không
const ZOTERO_CHANNEL_ID = process.env.ZOTERO_CHANNEL_ID; // Kênh để gửi thông báo
const ZOTERO_STATE_FILE = path.join(__dirname, 'data', 'zotero_state.json');

function loadZoteroState() {
    try {
        if (fs.existsSync(ZOTERO_STATE_FILE)) {
            return JSON.parse(fs.readFileSync(ZOTERO_STATE_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('[Zotero Polling] Lỗi đọc state file:', e.message);
    }
    return { lastDateAdded: null };
}

function saveZoteroState(state) {
    try {
        const dir = path.dirname(ZOTERO_STATE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(ZOTERO_STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
        console.error('[Zotero Polling] Lỗi ghi state file:', e.message);
    }
}

async function pollZoteroNewItems() {
    const API_KEY = process.env.ZOTERO_API_KEY;
    const LIBRARY_ID = process.env.ZOTERO_LIBRARY_ID;
    const LIBRARY_TYPE = process.env.ZOTERO_LIBRARY_TYPE || 'user';

    if (!API_KEY || !LIBRARY_ID || !ZOTERO_CHANNEL_ID) return;

    const channel = client.channels.cache.get(ZOTERO_CHANNEL_ID);
    if (!channel) return;

    try {
        const state = loadZoteroState();
        const base = `https://api.zotero.org/${LIBRARY_TYPE}s/${LIBRARY_ID}/items/top`;
        const params = new URLSearchParams({
            key: API_KEY,
            limit: '10',
            sort: 'dateAdded',
            direction: 'desc',
        });

        const res = await fetch(`${base}?${params.toString()}`, {
            headers: { 'Zotero-API-Version': '3' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Zotero API HTTP ${res.status}`);

        const items = (await res.json())
            .filter(it => !['attachment', 'note'].includes(it.data.itemType));

        if (!items.length) return;

        // Lọc ra các item mới hơn lần check trước
        const newItems = state.lastDateAdded
            ? items.filter(it => it.data.dateAdded > state.lastDateAdded)
            : []; // Lần đầu chạy: chỉ lưu state, không gửi thông báo

        if (newItems.length > 0) {
            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor(0xCC2936)
                .setTitle('📚 Tài liệu mới trong thư viện Zotero!')
                .setDescription(
                    newItems.map(it => {
                        const d = it.data;
                        const creators = d.creators?.length
                            ? d.creators.map(c => c.name || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()).filter(Boolean).join(', ')
                            : 'Không rõ tác giả';
                        const link = d.url || it.links?.alternate?.href || `https://www.zotero.org/${LIBRARY_TYPE}s/${LIBRARY_ID}/items/${it.key}`;
                        const year = d.date ? ` (${d.date.slice(0, 4)})` : '';
                        return `**[${d.title || 'Không có tiêu đề'}](${link})**${year}\n✍️ ${creators}`;
                    }).join('\n\n')
                )
                .setFooter({ text: `${newItems.length} tài liệu mới được thêm` })
                .setTimestamp();

            await channel.send({ embeds: [embed] });
            console.log(`[Zotero Polling] Đã gửi thông báo ${newItems.length} tài liệu mới`);
        }

        // Cập nhật state với dateAdded mới nhất
        state.lastDateAdded = items[0].data.dateAdded;
        saveZoteroState(state);
    } catch (error) {
        console.error('[Zotero Polling ERROR]', error.message);
    }
}

// ─── Deadline Reminder Cron Job ───────────────────────────────
// Mỗi ngày lúc 8:00 sáng kiểm tra deadline sắp tới (trong 1-3 ngày)
const DEADLINE_FILE = path.join(__dirname, 'data', 'deadlines.json');

function loadDeadlines() {
    try {
        if (fs.existsSync(DEADLINE_FILE)) {
            return JSON.parse(fs.readFileSync(DEADLINE_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error('[Deadline] Lỗi đọc file:', e.message);
    }
    return [];
}

async function checkDeadlineReminders() {
    const deadlines = loadDeadlines();
    if (!deadlines.length) return;

    const now = new Date();
    const REMINDER_CHANNEL_ID = process.env.DEADLINE_CHANNEL_ID;
    const channel = REMINDER_CHANNEL_ID ? client.channels.cache.get(REMINDER_CHANNEL_ID) : null;

    for (const dl of deadlines) {
        if (dl.done) continue;

        const deadline = new Date(dl.deadline);
        const diffMs = deadline.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        // Nhắc nhở khi còn 1, 2, hoặc 3 ngày
        if (diffDays >= 1 && diffDays <= 3) {
            const { EmbedBuilder } = require('discord.js');
            const dayLabel = diffDays === 1 ? '⚠️ **NGÀY MAI**' : `còn **${diffDays} ngày**`;
            const embed = new EmbedBuilder()
                .setColor(diffDays === 1 ? 0xFF4444 : 0xFFAA00)
                .setTitle('⏰ Nhắc nhở Deadline!')
                .setDescription(`📌 **${dl.title}**\n${dl.description || ''}\n\n📅 Hạn: <t:${Math.floor(deadline.getTime() / 1000)}:F> (${dayLabel})`)
                .setFooter({ text: `Được tạo bởi ${dl.creatorTag || 'Unknown'}` })
                .setTimestamp();

            // Gửi vào kênh
            if (channel) {
                await channel.send({ embeds: [embed] });
            }

            // Gửi DM cho người tạo
            try {
                const user = await client.users.fetch(dl.creatorId);
                await user.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Deadline] Không thể gửi DM cho ${dl.creatorId}: ${e.message}`);
            }
        }
    }
}

client.once('clientReady', () => {
    console.log(`🤖 Bot FredBoat-Clone đã online dưới tên ${client.user.tag}!`);

    // Khởi động cron jobs
    const cron = require('node-cron');

    // Zotero polling: mỗi 10 phút
    if (process.env.ZOTERO_CHANNEL_ID) {
        pollZoteroNewItems(); // Chạy ngay 1 lần lúc startup để set state
        cron.schedule('*/10 * * * *', pollZoteroNewItems);
        console.log('📚 Zotero auto-polling đã bật (mỗi 10 phút)');
    }

    // Deadline reminder: mỗi ngày lúc 8:00 sáng (UTC+7 = 1:00 UTC)
    cron.schedule('0 1 * * *', checkDeadlineReminders);
    console.log('⏰ Deadline reminder cron đã bật (hàng ngày lúc 8:00 sáng)');
});

client.login(process.env.DISCORD_TOKEN);