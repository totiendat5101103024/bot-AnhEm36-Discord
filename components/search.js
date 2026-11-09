'use strict';

/**
 * components/search.js — chọn kết quả tìm kiếm.
 */

const { register } = require('../utils/components');
const { errorEmbed, successEmbed } = require('../utils/ui');
const logger = require('../utils/logger');

const pending = new Map(); // sessionId -> { results, userId, voiceChannelId }

function createSession(data, ttlMs = 5 * 60_000) {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    pending.set(id, data);
    const timer = setTimeout(() => pending.delete(id), ttlMs);
    timer.unref?.();
    return id;
}

register('search', async (interaction, args) => {
    if (args[0] !== 'pick') return;

    const session = pending.get(args[1]);
    if (!session) {
        return interaction.reply({ embeds: [errorEmbed('Phiên tìm kiếm đã hết hạn, hãy dùng `/search` lại.')], ephemeral: true });
    }
    if (interaction.user.id !== session.userId) {
        return interaction.reply({ embeds: [errorEmbed('Đây không phải phiên tìm kiếm của bạn!')], ephemeral: true });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
        return interaction.reply({ embeds: [errorEmbed('Bạn đã rời kênh thoại!')], ephemeral: true });
    }

    const index = Number(interaction.values?.[0]);
    const song = session.results[index];
    if (!song) {
        return interaction.reply({ embeds: [errorEmbed('Kết quả không hợp lệ!')], ephemeral: true });
    }

    await interaction.deferUpdate();
    try {
        song.user = interaction.user;
        await interaction.client.distube.play(voiceChannel, song, {
            member: interaction.member,
            textChannel: interaction.channel,
        });
        pending.delete(args[1]);
        await interaction.editReply({
            embeds: [successEmbed(`Đã thêm **${song.name}** vào hàng đợi.`, '🎵 Đã chọn bài')],
            components: [],
        });
    } catch (err) {
        logger.warn('[search:pick]', err.message);
        await interaction.editReply({
            embeds: [errorEmbed(`Không phát được bài này: ${err.message?.slice(0, 250)}`)],
            components: [],
        });
    }
});

module.exports = { createSession };
