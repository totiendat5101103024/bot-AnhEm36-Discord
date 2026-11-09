'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { requireQueue } = require('../utils/music');
const { buildQueueEmbed, buildQueueRows } = require('../utils/player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Xem hàng đợi (phân trang)'),

    async execute(interaction) {
        const queue = await requireQueue(interaction);
        if (!queue) return;

        await interaction.reply({
            embeds: [buildQueueEmbed(queue, 1)],
            components: buildQueueRows(queue, 1),
        });
    },
};
