'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { buildHelpEmbed, buildHelpSelect } = require('../utils/helpView');

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Xem danh sách lệnh theo nhóm'),

    async execute(interaction) {
        await interaction.reply({
            embeds: [buildHelpEmbed(interaction.client, 'all', interaction.user)],
            components: [buildHelpSelect(interaction.client, 'all')],
        });
    },
};
