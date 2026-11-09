'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Đổi vị trí một bài trong hàng đợi (1 = bài kế tiếp)')
        .addIntegerOption((option) =>
            option.setName('tu_vi_tri').setDescription('Vị trí hiện tại').setRequired(true).setMinValue(1))
        .addIntegerOption((option) =>
            option.setName('den_vi_tri').setDescription('Vị trí muốn chuyển tới').setRequired(true).setMinValue(1)),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        const from = interaction.options.getInteger('tu_vi_tri', true);
        const to = interaction.options.getInteger('den_vi_tri', true);
        const last = queue.songs.length - 1;

        if (from > last || to > last) {
            return interaction.reply({ content: `❌ Vị trí hợp lệ từ 1 đến ${last}!`, ephemeral: true });
        }
        if (from === to) return interaction.reply({ content: '❌ Vị trí cũ và mới giống nhau!', ephemeral: true });

        const [song] = queue.songs.splice(from, 1);
        queue.songs.splice(to, 0, song);
        await interaction.reply(`↔️ Đã chuyển **${song.name}** từ vị trí ${from} sang ${to}.`);
    },
};
