'use strict';

const { SlashCommandBuilder } = require('discord.js');
const videopoker = require('../../games/videopoker');

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('videopoker')
        .setDescription('Video Poker Jacks or Better — giữ bài và đổi bài')
        .addIntegerOption((o) =>
            o.setName('cuoc')
                .setDescription('Số xu đặt cược')
                .setRequired(true)
                .setMinValue(50)
                .setMaxValue(5000)),

    async execute(interaction) {
        await videopoker.start(interaction, interaction.options.getInteger('cuoc', true));
    },
};
