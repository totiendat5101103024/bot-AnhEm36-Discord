'use strict';

/**
 * events/voiceStateUpdate.js
 *  - Temp voice "Join to Create"
 *  - Ghi phiên voice để tính giờ học
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { db } = require('../utils/db');
const settings = require('../utils/settings');
const logger = require('../utils/logger');

const getTempChannel = db.prepare('SELECT * FROM temp_channels WHERE channel_id = ?');
const insertTempChannel = db.prepare('INSERT OR REPLACE INTO temp_channels (channel_id, guild_id, owner_id, created_at) VALUES (?, ?, ?, ?)');
const deleteTempChannel = db.prepare('DELETE FROM temp_channels WHERE channel_id = ?');
const updateTempOwner = db.prepare('UPDATE temp_channels SET owner_id = ? WHERE channel_id = ?');

const closeSession = db.prepare(`
    UPDATE voice_sessions SET left_at = ?
    WHERE guild_id = ? AND user_id = ? AND left_at IS NULL
`);
const openSession = db.prepare(`
    INSERT INTO voice_sessions (guild_id, user_id, channel_id, channel_name, joined_at, study, subject)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const getStudySession = db.prepare(`
    SELECT * FROM study_sessions WHERE channel_id = ? AND active = 1 LIMIT 1
`);

function isStudy(channelId) {
    return getStudySession.get(channelId) || null;
}

async function createTempChannel(state) {
    const guild = state.guild;
    const member = state.member;
    if (!member || member.user.bot) return;

    const s = settings.get(guild.id);
    const parentId = s.temp_voice_category_id || state.channel?.parentId || null;

    try {
        const channel = await guild.channels.create({
            name: member.displayName.slice(0, 90),
            type: ChannelType.GuildVoice,
            parent: parentId || undefined,
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
                },
                {
                    id: member.id,
                    allow: [
                        PermissionFlagsBits.ManageChannels,
                        PermissionFlagsBits.MoveMembers,
                        PermissionFlagsBits.Connect,
                    ],
                },
            ],
            reason: `Kênh voice tạm cho ${member.user.tag}`,
        });

        insertTempChannel.run(channel.id, guild.id, member.id, Date.now());
        await member.voice.setChannel(channel).catch((err) => {
            logger.warn(`[tempvoice] Không move được ${member.user.tag}: ${err.message}`);
        });

        await member.send([
            `🔊 Đã tạo kênh thoại tạm **${channel.name}**.`,
            'Bạn có thể dùng:',
            '`/voice name <tên>` — đổi tên',
            '`/voice limit <số>` — giới hạn người',
            '`/voice lock` / `/voice unlock` — khoá/mở',
            '`/voice claim` — nhận lại kênh nếu chủ cũ rời',
        ].join('\n')).catch(() => null);

        logger.info(`[tempvoice] Tạo ${channel.name} cho ${member.user.tag}`);
    } catch (err) {
        logger.error('[tempvoice] Không tạo được kênh:', err.message);
    }
}

async function handleTempLeave(oldState) {
    if (!oldState.channelId) return;
    const row = getTempChannel.get(oldState.channelId);
    if (!row) return;

    const guild = oldState.guild;
    const channel = guild.channels.cache.get(row.channel_id)
        || await guild.channels.fetch(row.channel_id).catch(() => null);

    if (!channel) {
        deleteTempChannel.run(row.channel_id);
        return;
    }

    if (channel.members.size === 0) {
        await channel.delete('Kênh voice tạm trống').catch(() => null);
        deleteTempChannel.run(row.channel_id);
        return;
    }

    // Chủ kênh rời nhưng còn người → chuyển quyền cho người đầu tiên.
    if (row.owner_id === oldState.id) {
        const next = channel.members.find((m) => !m.user.bot);
        if (next) {
            updateTempOwner.run(next.id, channel.id);
            await channel.permissionOverwrites.edit(next.id, {
                ManageChannels: true,
                MoveMembers: true,
            }).catch(() => null);
        }
    }
}

async function trackSession(oldState, newState) {
    if (oldState.channelId === newState.channelId) return;
    if (newState.member?.user?.bot) return;

    closeSession.run(Date.now(), newState.guild.id, newState.id);

    if (!newState.channelId) return;

    const study = isStudy(newState.channelId);
    openSession.run(
        newState.guild.id,
        newState.id,
        newState.channelId,
        newState.channel?.name || null,
        Date.now(),
        study ? 1 : 0,
        study?.subject || null,
    );
}

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        try {
            if (!newState.member) return;
            const s = settings.get(newState.guild.id);

            if (s.temp_voice_channel_id && newState.channelId === s.temp_voice_channel_id) {
                await createTempChannel(newState);
            }

            if (oldState.channelId && oldState.channelId !== newState.channelId) {
                await handleTempLeave(oldState);
            }

            await trackSession(oldState, newState);
        } catch (err) {
            logger.error('[voiceStateUpdate]', err);
        }
    },
};
