'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Tạm dừng bài hát đang phát'),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        if (queue.paused) return interaction.reply({ content: '⏸️ Bài hát đã đang tạm dừng rồi!', ephemeral: true });

        await queue.pause();
        await interaction.reply('⏸️ Đã tạm dừng bài hát.');
    },
};
