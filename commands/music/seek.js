'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Tua bài đang phát tới một vị trí')
        .addIntegerOption((option) =>
            option
                .setName('giay')
                .setDescription('Tua tới giây thứ bao nhiêu (0 = đầu bài)')
                .setRequired(true)
                .setMinValue(0)),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        const seconds = interaction.options.getInteger('giay', true);
        await queue.seek(seconds);
        await interaction.reply(`⏱️ Đã tua tới **${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}**.`);
    },
};
