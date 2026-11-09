'use strict';

/**
 * jobs/idle.js — tự rời voice khi bot bị bỏ quên.
 *
 * Hai trường hợp:
 *  - Không còn ai trong kênh thoại quá lâu (dự phòng nếu event `empty` bị lỡ,
 *    ví dụ bot vừa restart khi kênh đã trống).
 *  - Nhạc bị tạm dừng quá `idle_timeout` (mặc định 10 phút).
 *
 * Bỏ qua guild đang bật 24/7.
 */

const logger = require('../utils/logger');
const settings = require('../utils/settings');
const { safeSend } = require('../utils/music');

const SWEEP_MS = 30_000;
const EMPTY_LEAVE_MS = 60_000;

let sweeping = false;

async function sweep(client) {
    if (sweeping) return;
    sweeping = true;

    try {
        const collection = client.distube?.queues?.collection;
        if (!collection) return;

        const now = Date.now();

        for (const queue of [...collection.values()]) {
            try {
                const s = settings.get(queue.id);
                if (s.mode_247) continue;
                if (!queue.songs?.length) continue;

                const idleMs = Math.max(60, Number(s.idle_timeout) || 600) * 1000;

                let channel = null;
                try {
                    channel = queue.voiceChannel;
                } catch {
                    channel = null;
                }

                const humans = channel?.members?.filter?.((m) => !m.user.bot).size ?? 0;

                if (channel && humans === 0) {
                    queue._emptySince ||= now;
                    const wait = Math.min(idleMs, EMPTY_LEAVE_MS);
                    if (now - queue._emptySince >= wait) {
                        logger.info(`[idle] ${queue.id}: kênh trống, rời voice.`);
                        await safeSend(queue.textChannel, {
                            content: '👋 Kênh thoại không còn ai, bot rời kênh.',
                        });
                        queue._idleStop = true;
                        await queue.stop().catch(() => null);
                        queue.distube.voices.leave(queue.id);
                        continue;
                    }
                } else {
                    queue._emptySince = 0;
                }

                if (queue.paused && !queue.stopped) {
                    queue._pausedSince ||= now;
                    if (now - queue._pausedSince >= idleMs) {
                        const minutes = Math.round(idleMs / 60_000);
                        logger.info(`[idle] ${queue.id}: tạm dừng ${minutes} phút, rời voice.`);
                        await safeSend(queue.textChannel, {
                            content: `⏸️ Nhạc đã tạm dừng quá **${minutes} phút**, bot rời kênh để tiết kiệm tài nguyên.`,
                        });
                        queue._idleStop = true;
                        await queue.stop().catch(() => null);
                        queue.distube.voices.leave(queue.id);
                    }
                } else {
                    queue._pausedSince = 0;
                }
            } catch (err) {
                logger.debug('[idle] bỏ qua queue:', err.message);
            }
        }
    } finally {
        sweeping = false;
    }
}

function startIdleWatcher(client) {
    const timer = setInterval(() => sweep(client), SWEEP_MS);
    timer.unref?.();
    logger.info(`🧹 Idle watcher đã bật (quét mỗi ${SWEEP_MS / 1000}s).`);
    return timer;
}

module.exports = { startIdleWatcher, sweep };
