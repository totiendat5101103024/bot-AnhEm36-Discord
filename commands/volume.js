'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../utils/music');
const settings = require('../utils/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Xem hoặc chỉnh âm lượng (0 - 100)')
        .addIntegerOption((option) =>
            option
                .setName('muc')
                .setDescription('Mức âm lượng (bỏ trống để xem hiện tại)')
                .setMinValue(0)
                .setMaxValue(100)
                .setRequired(false)),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        const muc = interaction.options.getInteger('muc');
        if (muc === null) {
            return interaction.reply(`🔊 Âm lượng hiện tại: **${queue.volume}%**`);
        }

        queue.setVolume(muc);
        settings.set(interaction.guildId, { default_volume: muc });
        await interaction.reply(`🔊 Đã chỉnh âm lượng thành **${muc}%**.`);
    },
};
