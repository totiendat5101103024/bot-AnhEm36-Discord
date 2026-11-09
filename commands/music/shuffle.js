'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Xáo trộn hàng đợi'),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        if (queue.songs.length < 2) {
            return interaction.reply({ content: '❌ Cần ít nhất 2 bài mới xáo trộn được!', ephemeral: true });
        }

        await queue.shuffle();
        await interaction.reply(`🔀 Đã xáo trộn **${queue.songs.length} bài** trong hàng đợi.`);
    },
};
