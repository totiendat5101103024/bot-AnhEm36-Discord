const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Xem danh sách các bài hát đang chờ được phát'),
    
    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Hàng đợi đang trống rỗng!', ephemeral: true });

        // Lấy tối đa 10 bài tiếp theo để tránh text bị quá dài vượt giới hạn Discord
        const q = queue.songs
            .map((song, i) => `${i === 0 ? '▶️ **Đang phát:**' : `**#${i}**.`} \`${song.name}\` - \`[${song.formattedDuration}]\``)
            .slice(0, 11)
            .join('\n');

        await interaction.reply(`🎶 **DANH SÁCH HÀNG ĐỢI:**\n\n${q}\n\n*Còn lại: ${queue.songs.length} bài hát trong danh sách.*`);
    },
};