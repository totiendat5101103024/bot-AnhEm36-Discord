'use strict';

/**
 * events/ready.js — chạy khi bot online: presence, cron, dọn dẹp phiên cũ.
 */

const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const { db } = require('../utils/db');
const { startZoteroPolling } = require('../jobs/zotero');
const { startDeadlineReminders } = require('../jobs/deadlines');
const { startIdleWatcher } = require('../jobs/idle');
const { refundStaleEscrow } = require('../games/poker/manager');

function reconcileVoiceSessions(client) {
    const open = db.prepare('SELECT * FROM voice_sessions WHERE left_at IS NULL').all();
    const close = db.prepare('UPDATE voice_sessions SET left_at = ? WHERE id = ?');
    let kept = 0;

    for (const row of open) {
        const guild = client.guilds.cache.get(row.guild_id);
        const state = guild?.voiceStates?.cache?.get(row.user_id);
        if (state?.channelId === row.channel_id) {
            kept++;
            continue;
        }
        // Bot không theo dõi được lúc offline → đóng với thời lượng 0
        close.run(row.joined_at, row.id);
    }

    // Mở phiên mới cho người đang ở trong voice mà chưa có phiên mở
    const insert = db.prepare(`
        INSERT INTO voice_sessions (guild_id, user_id, channel_id, channel_name, joined_at, study)
        VALUES (?, ?, ?, ?, ?, 0)
    `);
    for (const guild of client.guilds.cache.values()) {
        for (const state of guild.voiceStates.cache.values()) {
            if (!state.channelId || state.member?.user?.bot) continue;
            const has = db.prepare(`
                SELECT 1 FROM voice_sessions
                WHERE guild_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1
            `).get(guild.id, state.id);
            if (!has) {
                insert.run(guild.id, state.id, state.channelId, state.channel?.name || null, Date.now());
            }
        }
    }

    logger.info(`[voice] Đối soát phiên voice: giữ ${kept}, đã đóng phần còn lại.`);
}

async function cleanupTempChannels(client) {
    const rows = db.prepare('SELECT * FROM temp_channels').all();
    const del = db.prepare('DELETE FROM temp_channels WHERE channel_id = ?');
    for (const row of rows) {
        const guild = client.guilds.cache.get(row.guild_id);
        if (!guild) continue;
        const channel = guild.channels.cache.get(row.channel_id)
            || await guild.channels.fetch(row.channel_id).catch(() => null);
        if (!channel) {
            del.run(row.channel_id);
            continue;
        }
        if (channel.members.size === 0) {
            await channel.delete('Dọn kênh voice tạm còn trống').catch(() => null);
            del.run(row.channel_id);
        }
    }
}

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        logger.info(`🤖 Bot đã online: ${client.user.tag} (${client.guilds.cache.size} server)`);

        client.user.setPresence({
            activities: [{ name: '/help • nhạc & game', type: ActivityType.Listening }],
            status: 'online',
        });

        startZoteroPolling(client);
        startDeadlineReminders(client);
        startIdleWatcher(client);

        try {
            refundStaleEscrow();
        } catch (err) {
            logger.error('[ready] Hoàn tiền poker thất bại:', err);
        }

        try {
            reconcileVoiceSessions(client);
            await cleanupTempChannels(client);
        } catch (err) {
            logger.error('[ready] Lỗi dọn dẹp phiên cũ:', err);
        }

        try {
            require('../utils/studyManager').resumeAll(client);
        } catch (err) {
            logger.debug('[ready] Chưa có studyManager:', err.message);
        }
    },
};
