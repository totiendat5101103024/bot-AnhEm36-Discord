'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài hiện tại'),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        if (queue.songs.length <= 1) {
            await queue.stop();
            return interaction.reply('⏭️ Đã bỏ qua bài cuối cùng, hàng đợi trống.');
        }

        const next = await queue.skip();
        await interaction.reply(`⏭️ Đã bỏ qua. Tiếp theo: **${next?.name ?? 'bài kế tiếp'}**`);
    },
};
