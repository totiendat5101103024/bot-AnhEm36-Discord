'use strict';

const { SlashCommandBuilder } = require('discord.js');
const manager = require('../../games/poker/manager');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('pokerbot')
        .setDescription('Texas Hold\'em heads-up với bot AI (Monte Carlo)')
        .addIntegerOption((o) =>
            o.setName('mua_chip')
                .setDescription('Số xu mua chip (200–5000)')
                .setRequired(false)
                .setMinValue(manager.MIN_BUY_IN)
                .setMaxValue(manager.MAX_BUY_IN)),

    async execute(interaction) {
        const buyIn = interaction.options.getInteger('mua_chip') ?? 500;
        await manager.createBotGame(interaction, buyIn);
    },
};
