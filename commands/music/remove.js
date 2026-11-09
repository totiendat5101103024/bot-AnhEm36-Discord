'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Xoá một bài khỏi hàng đợi (1 = bài kế tiếp)')
        .addIntegerOption((option) =>
            option
                .setName('vi_tri')
                .setDescription('Vị trí bài cần xoá (1 = bài kế tiếp)')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        const index = interaction.options.getInteger('vi_tri', true);
        if (index >= queue.songs.length) {
            return interaction.reply({ content: `❌ Hàng đợi chỉ có **${queue.songs.length - 1}** bài sau bài đang phát!`, ephemeral: true });
        }

        const [removed] = queue.songs.splice(index, 1);
        await interaction.reply(`🗑️ Đã xoá **${removed?.name ?? 'bài hát'}** khỏi hàng đợi.`);
    },
};
