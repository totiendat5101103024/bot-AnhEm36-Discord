'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../../utils/music');
const { requireSameVoice, safeError } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Cho bot rời kênh thoại'),

    async execute(interaction) {
        const queue = getQueue(interaction.client, interaction.guildId);

        if (queue) {
            if (!(await requireSameVoice(interaction, queue))) return;
        } else {
            const botVoice = interaction.guild.members.me?.voice?.channel;
            if (!botVoice) return safeError(interaction, 'Bot đang không ở trong kênh thoại nào!');
        }

        await interaction.client.distube.voices.leave(interaction.guildId);
        if (queue) await queue.stop().catch(() => null);
        await interaction.reply('👋 Đã rời kênh thoại.');
    },
};
