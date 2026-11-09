const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Bỏ qua bài hát hiện tại để sang bài tiếp theo'),
    
    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Hiện tại không có bài hát nào đang phát!', ephemeral: true });

        try {
            // Nếu đây là bài cuối cùng trong hàng đợi
            if (queue.songs.length <= 1) {
                await queue.stop();
                return interaction.reply('⏭️ Đã bỏ qua bài cuối cùng. Hàng đợi trống!');
            }
            
            await interaction.client.distube.skip(interaction.guildId);
            await interaction.reply('⏭️ Đã bỏ qua bài hát hiện tại!');
        } catch (error) {
            await interaction.reply('❌ Không thể skip (có thể hàng đợi chỉ còn 1 bài).');
        }
    },
};