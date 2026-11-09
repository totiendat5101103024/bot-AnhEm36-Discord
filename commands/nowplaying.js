'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { requireQueue } = require('../utils/music');
const { buildNowPlayingEmbed, buildPlayerRows } = require('../utils/player');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Xem bài đang phát kèm nút điều khiển'),

    async execute(interaction) {
        const queue = await requireQueue(interaction);
        if (!queue) return;

        await interaction.reply({
            embeds: [buildNowPlayingEmbed(queue)],
            components: buildPlayerRows(queue),
        });
    },
};
