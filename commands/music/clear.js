'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../../utils/music');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Xoá toàn bộ bài chờ, giữ bài đang phát'),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        const removed = queue.songs.length - 1;
        if (removed <= 0) {
            return interaction.reply({ content: '❌ Không có bài nào đang chờ để xoá!', ephemeral: true });
        }

        queue.songs.splice(1);
        await interaction.reply(`🧹 Đã xoá **${removed} bài** đang chờ.`);
    },
};
