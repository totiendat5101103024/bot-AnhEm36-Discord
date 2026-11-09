'use strict';

const { SlashCommandBuilder } = require('discord.js');
const manager = require('../../games/poker/manager');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('poker')
        .setDescription('Texas Hold\'em 2–6 người — tạo bàn và mời mọi người tham gia')
        .addIntegerOption((o) =>
            o.setName('mua_chip')
                .setDescription('Số xu mua chip (200–5000)')
                .setRequired(false)
                .setMinValue(manager.MIN_BUY_IN)
                .setMaxValue(manager.MAX_BUY_IN)),

    async execute(interaction) {
        const buyIn = interaction.options.getInteger('mua_chip') ?? 500;
        await manager.createLobby(interaction, buyIn);
    },
};
