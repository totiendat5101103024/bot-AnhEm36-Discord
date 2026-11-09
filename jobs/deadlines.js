'use strict';

/**
 * jobs/deadlines.js — nhắc deadline hàng ngày.
 */

const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const logger = require('../utils/logger');
const { safeSend } = require('../utils/music');

const DEADLINE_FILE = path.join(__dirname, '..', 'data', 'deadlines.json');

function loadDeadlines() {
    try {
        if (fs.existsSync(DEADLINE_FILE)) {
            return JSON.parse(fs.readFileSync(DEADLINE_FILE, 'utf-8'));
        }
    } catch (err) {
        logger.error('[Deadline] Lỗi đọc file:', err.message);
    }
    return [];
}

async function checkDeadlineReminders(client) {
    const deadlines = loadDeadlines();
    if (!deadlines.length) return;

    const now = new Date();
    const channelId = process.env.DEADLINE_CHANNEL_ID;
    const channel = channelId
        ? await client.channels.fetch(channelId).catch(() => null)
        : null;

    for (const dl of deadlines) {
        if (dl.done) continue;

        const deadline = new Date(dl.deadline);
        const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / 86_400_000);

        if (diffDays >= 1 && diffDays <= 3) {
            const dayLabel = diffDays === 1 ? '⚠️ **NGÀY MAI**' : `còn **${diffDays} ngày**`;
            const embed = new EmbedBuilder()
                .setColor(diffDays === 1 ? 0xff4444 : 0xffaa00)
                .setTitle('⏰ Nhắc nhở Deadline!')
                .setDescription(
                    `📌 **${dl.title}**\n${dl.description || ''}\n\n`
                    + `📅 Hạn: <t:${Math.floor(deadline.getTime() / 1000)}:F> (${dayLabel})`,
                )
                .setFooter({ text: `Được tạo bởi ${dl.creatorTag || 'Unknown'}` })
                .setTimestamp();

            if (channel) await safeSend(channel, { embeds: [embed] });

            try {
                const user = await client.users.fetch(dl.creatorId);
                await user.send({ embeds: [embed] });
            } catch (err) {
                logger.warn(`[Deadline] Không gửi được DM cho ${dl.creatorId}: ${err.message}`);
            }
        }
    }
}

function startDeadlineReminders(client) {
    // 8:00 sáng UTC+7 = 1:00 UTC
    cron.schedule('0 1 * * *', () => checkDeadlineReminders(client));
    logger.info('⏰ Deadline reminder cron đã bật (08:00 sáng mỗi ngày).');
}

module.exports = { checkDeadlineReminders, startDeadlineReminders };
