'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('jump')
        .setDescription('Nhảy tới một bài trong hàng đợi (1 = bài kế tiếp)')
        .addIntegerOption((option) =>
            option
                .setName('vi_tri')
                .setDescription('1 = bài kế tiếp, -1 = bài trước')
                .setRequired(true)
                .setMinValue(-100)
                .setMaxValue(100)),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        const position = interaction.options.getInteger('vi_tri', true);
        if (position === 0) {
            return interaction.reply({ content: '❌ Vị trí 0 không hợp lệ!', ephemeral: true });
        }

        try {
            const song = await queue.jump(position);
            await interaction.reply(`⏭️ Đã nhảy tới **${song?.name ?? 'bài hát'}**.`);
        } catch (err) {
            await interaction.reply({ content: `❌ Không nhảy được: ${err.message?.slice(0, 200)}`, ephemeral: true });
        }
    },
};
