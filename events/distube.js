'use strict';

/**
 * events/distube.js — toàn bộ event của DisTube.
 * Mọi lần gửi tin đều có .catch() để không làm crash bot.
 */

const logger = require('../utils/logger');
const { safeSend } = require('../utils/music');
const { sendPlayerPanel, removePanel } = require('../utils/player');
const settings = require('../utils/settings');

function autoDelete(msg, ms = 12_000) {
    if (!msg) return;
    const timer = setTimeout(() => {
        msg.delete().catch(() => null);
    }, ms);
    timer.unref?.();
}

function getPlugin(queue) {
    return queue.distube.plugins.find((p) => typeof p.prefetchStreamURL === 'function');
}

async function prefetchNext(queue) {
    const plugin = getPlugin(queue);
    if (!plugin) return;
    const next = queue.songs.slice(1, 3);
    for (const song of next) {
        plugin.prefetchStreamURL(song).catch((err) => {
            logger.debug(`[Prefetch] ${song.name}: ${err.message}`);
        });
    }
}

module.exports = {
    setup: true,
    execute(client) {
        client.distube
            .on('playSong', (queue, song) => {
                const s = settings.get(queue.id);
                if (!queue._volumeInitialized) {
                    queue._volumeInitialized = true;
                    try {
                        queue.setVolume(s.default_volume);
                    } catch {
                        // bỏ qua
                    }
                }
                if (s.autoplay && !queue.autoplay) queue.autoplay = true;

                sendPlayerPanel(queue.textChannel, queue, song).catch((err) => {
                    logger.warn('[playSong] Không gửi được panel:', err.message);
                });

                prefetchNext(queue);
                logger.info(`[play] ${queue.id} → ${song.name} (${song.formattedDuration})`);
            })
            .on('addSong', (queue, song) => {
                if (queue.songs.length <= 1) return;
                safeSend(queue.textChannel, {
                    content: `✅ Đã thêm **${song.name}** vào hàng đợi (vị trí #${queue.songs.length - 1}).`,
                }).then((msg) => autoDelete(msg));
            })
            .on('addList', (queue, playlist) => {
                safeSend(queue.textChannel, {
                    content: `📥 Đã nạp playlist **${playlist.name}** (${playlist.songs.length} bài).`,
                }).then((msg) => autoDelete(msg, 15_000));
            })
            .on('finish', (queue) => {
                if (!queue._idleStop) safeSend(queue.textChannel, { content: '✅ Hàng đợi đã phát hết.' });
                removePanel(client, queue.id);
                const s = settings.get(queue.id);
                if (!s.mode_247) {
                    queue.distube.voices.leave(queue.id);
                }
            })
            .on('deleteQueue', (queue) => {
                // stop()/lỗi xoá queue — dọn panel để không còn nút chết.
                removePanel(client, queue.id);
            })
            .on('empty', (queue) => {
                const s = settings.get(queue.id);
                if (s.mode_247) return;

                // Chờ 45 giây, nếu vẫn không có người thì rời kênh.
                const timer = setTimeout(() => {
                    try {
                        const channel = queue.voiceChannel;
                        const humans = channel?.members?.filter((m) => !m.user.bot).size ?? 0;
                        if (humans === 0) {
                            safeSend(queue.textChannel, { content: '👋 Kênh thoại trống, bot rời kênh.' });
                            queue.distube.voices.leave(queue.id);
                        }
                    } catch (err) {
                        logger.debug('[empty] bỏ qua:', err.message);
                    }
                }, 45_000);
                timer.unref?.();
            })
            .on('disconnect', (queue) => {
                removePanel(client, queue.id);
                safeSend(queue.textChannel, { content: '👋 Bot đã rời kênh thoại.' });
            })
            .on('noRelated', (queue) => {
                safeSend(queue.textChannel, { content: '🔎 Không tìm thấy bài liên quan để autoplay.' });
            })
            .on('error', (error, queue, song) => {
                logger.error('[DisTube ERROR]', error?.message || error);
                const channel = queue?.textChannel;
                const songInfo = song ? ` khi phát **${song.name}**` : '';
                safeSend(channel, {
                    content: `❌ Lỗi phát nhạc${songInfo}: ${String(error?.message || error).slice(0, 300)}`,
                });

                // Tự bỏ qua bài lỗi sau 2 lần để không kẹt hàng đợi.
                if (!queue) return;
                queue._errorCount = (queue._errorCount || 0) + 1;
                if (queue._errorCount >= 2 && queue.songs.length > 1) {
                    queue._errorCount = 0;
                    setTimeout(() => {
                        queue.skip().catch((err) => logger.warn('[error] Không skip được:', err.message));
                    }, 1500).unref?.();
                }
            })
            .on('debug', (message) => {
                logger.debug('[DisTube]', message);
            });
    },
};
