'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Tiếp tục phát bài hát đang tạm dừng'),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        if (!queue.paused) return interaction.reply({ content: '▶️ Bài hát đang phát rồi!', ephemeral: true });

        await queue.resume();
        await interaction.reply('▶️ Đã tiếp tục phát.');
    },
};
