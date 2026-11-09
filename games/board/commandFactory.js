'use strict';

/** commandFactory.js — tạo slash command thách đấu cho từng board game. */

const { SlashCommandBuilder } = require('discord.js');
const service = require('./service');

function createBoardCommand(type) {
    const label = service.LABELS[type];
    return {
        cooldown: 5,
        data: new SlashCommandBuilder()
            .setName(type)
            .setDescription(`Thách đấu ${label} — chơi async, lưu ván trong SQLite`)
            .addUserOption((o) =>
                o.setName('doi_thu')
                    .setDescription('Người bạn muốn thách đấu')
                    .setRequired(true)),

        async execute(interaction) {
            const opponent = interaction.options.getUser('doi_thu', true);
            await service.createChallenge(interaction, type, opponent);
        },
    };
}

module.exports = { createBoardCommand };
