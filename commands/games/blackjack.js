'use strict';

const { SlashCommandBuilder } = require('discord.js');
const blackjack = require('../../games/blackjack');

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('blackjack')
        .setDescription('Xì dách với dealer — Hit, Stand hoặc Double')
        .addIntegerOption((o) =>
            o.setName('cuoc')
                .setDescription('Số xu đặt cược')
                .setRequired(true)
                .setMinValue(50)
                .setMaxValue(5000)),

    async execute(interaction) {
        await blackjack.start(interaction, interaction.options.getInteger('cuoc', true));
    },
};
