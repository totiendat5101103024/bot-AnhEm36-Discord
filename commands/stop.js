const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Dừng phát nhạc hoàn toàn và xóa sạch hàng đợi'),
    
    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Bot có đang phát nhạc đâu mà dừng!', ephemeral: true });

        await queue.stop();
        await interaction.reply('⏹️ Đã dừng phát nhạc và xóa sạch danh sách hàng đợi theo lệnh!');
    },
};