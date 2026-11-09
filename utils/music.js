'use strict';

/**
 * music.js — helper dùng chung cho các lệnh nhạc.
 */

const { errorEmbed } = require('./ui');
const { safeReply, requireVoice, requireSameVoice, checkVoicePermissions } = require('./permissions');
const settings = require('./settings');
const logger = require('./logger');

function getQueue(client, guildId) {
    return client.distube.getQueue(guildId);
}

async function requireQueue(interaction) {
    const queue = getQueue(interaction.client, interaction.guildId);
    if (!queue) {
        await safeReply(interaction, {
            embeds: [errorEmbed('Hiện không có bài hát nào đang phát!')],
            ephemeral: true,
        });
        return null;
    }
    return queue;
}

/**
 * Kiểm tra đầy đủ trước khi join/play.
 */
async function preparePlay(interaction) {
    const voiceChannel = await requireVoice(interaction);
    if (!voiceChannel) return null;

    const perms = checkVoicePermissions(voiceChannel);
    if (!perms.ok) {
        await safeReply(interaction, { embeds: [errorEmbed(perms.message)], ephemeral: true });
        return null;
    }

    return voiceChannel;
}

async function prepareControl(interaction) {
    const queue = await requireQueue(interaction);
    if (!queue) return null;

    const same = await requireSameVoice(interaction, queue);
    if (!same) return null;

    return queue;
}

function guildSettings(guildId) {
    return settings.get(guildId);
}

/**
 * Gửi tin an toàn — dùng trong event, nơi không có interaction để catch.
 */
function safeSend(channel, payload) {
    if (!channel || typeof channel.send !== 'function') return Promise.resolve(null);
    return channel.send(payload).catch((err) => {
        logger.warn(`[send] Không gửi được tin vào #${channel.id ?? '?'}: ${err.message}`);
        return null;
    });
}

function queueDuration(queue) {
    return queue.songs.reduce((sum, song) => sum + (song.duration || 0), 0);
}

module.exports = {
    getQueue,
    requireQueue,
    preparePlay,
    prepareControl,
    guildSettings,
    safeSend,
    queueDuration,
};
