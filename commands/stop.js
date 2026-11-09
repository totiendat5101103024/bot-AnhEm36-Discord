'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Dừng phát nhạc và xoá hàng đợi'),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        await queue.stop();
        await interaction.reply('⏹️ Đã dừng phát nhạc và xoá hàng đợi.');
    },
};
