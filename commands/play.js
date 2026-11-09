'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { preparePlay, getQueue, guildSettings } = require('../utils/music');
const { errorEmbed, successEmbed } = require('../utils/ui');
const logger = require('../utils/logger');

module.exports = {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Phát nhạc từ YouTube, Spotify, SoundCloud hoặc từ khoá tìm kiếm')
        .addStringOption((option) =>
            option
                .setName('link')
                .setDescription('Link bài hát/playlist hoặc từ khoá tìm kiếm')
                .setRequired(true)
                .setMaxLength(500)),

    async execute(interaction) {
        const voiceChannel = await preparePlay(interaction);
        if (!voiceChannel) return;

        const query = interaction.options.getString('link', true).trim();

        // Chặn trước khi thêm: tránh hàng đợi phình vô hạn.
        const maxQueue = guildSettings(interaction.guildId).max_queue;
        const current = getQueue(interaction.client, interaction.guildId);
        if (current && current.songs.length >= maxQueue) {
            return interaction.reply({
                embeds: [errorEmbed(`Hàng đợi đã đạt giới hạn **${maxQueue} bài**. Hãy dùng \`/clear\` hoặc chờ bot phát bớt!`)],
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        try {
            await interaction.client.distube.play(voiceChannel, query, {
                member: interaction.member,
                textChannel: interaction.channel,
            });

            await interaction.editReply({
                embeds: [successEmbed(`Đã nhận: \`${query.slice(0, 200)}\`\nBài đang phát sẽ hiện ở panel bên dưới.`, '🎵 Đã thêm vào hàng đợi')],
            });
        } catch (err) {
            logger.warn('[play]', err.message);
            await interaction.editReply({
                embeds: [errorEmbed(`Không phát được: ${String(err.message || err).slice(0, 400)}`)],
            }).catch(() => null);
        }
    },
};
