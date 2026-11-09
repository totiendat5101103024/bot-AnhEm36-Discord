'use strict';

/**
 * permissions.js — kiểm tra voice/quyền và reply an toàn.
 */

const { PermissionFlagsBits } = require('discord.js');
const { errorEmbed } = require('./ui');
const logger = require('./logger');

async function safeReply(interaction, options) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(options);
        }
        return await interaction.reply(options);
    } catch (err) {
        logger.debug('[safeReply] không gửi được:', err.message);
        return null;
    }
}

async function safeError(interaction, message) {
    return safeReply(interaction, { embeds: [errorEmbed(message)], ephemeral: true });
}

/**
 * Trả về voice channel của member, hoặc null (đã reply lỗi).
 */
async function requireVoice(interaction) {
    const channel = interaction.member?.voice?.channel;
    if (!channel) {
        await safeError(interaction, 'Bạn phải vào một **kênh thoại** trước!');
        return null;
    }
    return channel;
}

/**
 * Kiểm tra bot và user cùng kênh voice với queue.
 */
async function requireSameVoice(interaction, queue) {
    const userChannel = interaction.member?.voice?.channel;
    const botChannel = queue?.voiceChannel;
    if (!userChannel) {
        await safeError(interaction, 'Bạn phải vào kênh thoại trước!');
        return false;
    }
    if (botChannel && userChannel.id !== botChannel.id) {
        await safeError(interaction, `Bạn phải ở cùng kênh thoại với bot (<#${botChannel.id}>)!`);
        return false;
    }
    return true;
}

function isAdmin(member) {
    if (!member) return false;
    if (member.id === member.guild?.ownerId) return true;
    return member.permissions?.has(PermissionFlagsBits.Administrator)
        || member.permissions?.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Admin, DJ role, hoặc người đang ở cùng voice channel.
 */
function canControl(member, queue, settings = {}) {
    if (isAdmin(member)) return true;
    if (settings.dj_role_id && member?.roles?.cache?.has?.(settings.dj_role_id)) return true;
    const userChannel = member?.voice?.channel;
    return !!userChannel && !!queue?.voiceChannel && userChannel.id === queue.voiceChannel.id;
}

/**
 * Kiểm tra bot có quyền Connect + Speak trong kênh voice.
 */
function checkVoicePermissions(channel) {
    const me = channel?.guild?.members?.me;
    if (!me) return { ok: false, message: 'Không tìm thấy thông tin bot trong server!' };
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.Connect)) {
        return { ok: false, message: `Bot không có quyền **Connect** vào <#${channel.id}>!` };
    }
    if (!perms?.has(PermissionFlagsBits.Speak)) {
        return { ok: false, message: `Bot không có quyền **Speak** trong <#${channel.id}>!` };
    }
    return { ok: true };
}

module.exports = {
    safeReply,
    safeError,
    requireVoice,
    requireSameVoice,
    isAdmin,
    canControl,
    checkVoicePermissions,
};
