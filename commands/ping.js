'use strict';

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Kiểm tra độ trễ của bot'),

    async execute(interaction) {
        const start = Date.now();
        await interaction.reply('🏓 Đang đo...');
        const msg = await interaction.fetchReply();
        const rtt = Date.now() - start;
        const ws = Math.round(interaction.client.ws.ping);

        await interaction.editReply([
            '🏓 **Pong!**',
            `📡 WebSocket: **${ws}ms**`,
            `⚡ Vòng lặp: **${rtt}ms**`,
            `🟢 Trạng thái: **${interaction.client.user.presence?.status || 'online'}**`,
        ].join('\n'));
    },
};
