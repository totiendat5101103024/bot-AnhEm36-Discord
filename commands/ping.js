const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Kiểm tra độ trễ của Bot!'),
    
    async execute(interaction) {
        await interaction.reply(`🏓 Pong! Chào Tiến Đạt, bot đang hoạt động ngon lành!`);
    },
};