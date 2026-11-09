'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../../utils/music');
const settings = require('../../utils/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Bật/tắt tự động phát bài liên quan khi hết hàng đợi'),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        queue.autoplay = !queue.autoplay;
        settings.set(interaction.guildId, { autoplay: queue.autoplay ? 1 : 0 });

        await interaction.reply(queue.autoplay
            ? '🔁 Đã **bật autoplay** — hết hàng đợi bot sẽ tự thêm bài liên quan.'
            : '⏹️ Đã **tắt autoplay**.');
    },
};
