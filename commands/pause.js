const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Tạm dừng bài hát đang phát'),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Hiện tại không có bài hát nào đang phát!', ephemeral: true });

        if (queue.paused) {
            return interaction.reply({ content: '⏸️ Bài hát đã đang tạm dừng rồi!', ephemeral: true });
        }

        queue.pause();
        await interaction.reply('⏸️ Đã tạm dừng bài hát!');
    },
};
