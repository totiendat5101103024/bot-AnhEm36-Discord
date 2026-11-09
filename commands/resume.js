const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Tiếp tục phát bài hát đang tạm dừng'),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Hiện tại không có bài hát nào đang phát!', ephemeral: true });

        if (!queue.paused) {
            return interaction.reply({ content: '▶️ Bài hát đang phát rồi, đâu có tạm dừng đâu!', ephemeral: true });
        }

        queue.resume();
        await interaction.reply('▶️ Đã tiếp tục phát bài hát!');
    },
};
