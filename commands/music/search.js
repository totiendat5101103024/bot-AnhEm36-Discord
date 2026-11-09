'use strict';

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { preparePlay } = require('../../utils/music');
const { formatDuration, baseEmbed, COLORS, truncate, errorEmbed } = require('../../utils/ui');
const { createSession } = require('../../components/search');
const logger = require('../../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Tìm 5 bài trên YouTube rồi chọn bài muốn phát')
        .addStringOption((option) =>
            option
                .setName('tu_khoa')
                .setDescription('Tên bài hát hoặc nghệ sĩ')
                .setRequired(true)
                .setMaxLength(200)),

    async execute(interaction) {
        const voiceChannel = await preparePlay(interaction);
        if (!voiceChannel) return;

        const query = interaction.options.getString('tu_khoa', true).trim();
        await interaction.deferReply();

        try {
            const results = await interaction.client.ytDlpExtractor.searchSongs(query, 5, {});
            if (!results.length) {
                return interaction.editReply({ embeds: [errorEmbed(`Không tìm thấy kết quả cho **${query}**.`)] });
            }

            const sessionId = createSession({
                results,
                userId: interaction.user.id,
                voiceChannelId: voiceChannel.id,
            });

            const embed = baseEmbed({
                color: COLORS.music,
                title: '🔎 Kết quả tìm kiếm',
                description: results.map((song, i) =>
                    `**${i + 1}.** [${truncate(song.name, 80)}](${song.url}) \`${formatDuration(song.duration)}\``,
                ).join('\n'),
                footer: `Chọn bài bên dưới • từ khoá: ${query}`,
            });

            const menu = new StringSelectMenuBuilder()
                .setCustomId(`search:pick:${sessionId}`)
                .setPlaceholder('Chọn bài để phát')
                .addOptions(results.map((song, i) => ({
                    label: truncate(song.name, 100),
                    description: truncate(`${song.uploader?.name || 'YouTube'} • ${formatDuration(song.duration)}`, 100),
                    value: String(i),
                })));

            await interaction.editReply({
                embeds: [embed],
                components: [new ActionRowBuilder().addComponents(menu)],
            });
        } catch (err) {
            logger.warn('[search]', err.message);
            await interaction.editReply({ embeds: [errorEmbed(`Tìm kiếm lỗi: ${err.message?.slice(0, 300)}`)] });
        }
    },
};
