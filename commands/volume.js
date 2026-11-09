const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Xem hoặc chỉnh âm lượng của bot (0 - 100)')
        .addIntegerOption(option =>
            option.setName('muc')
                .setDescription('Mức âm lượng muốn set (bỏ trống để xem mức hiện tại)')
                .setMinValue(0)
                .setMaxValue(100)
                .setRequired(false)),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Hiện tại không có bài hát nào đang phát!', ephemeral: true });

        const muc = interaction.options.getInteger('muc');

        // Không truyền giá trị → chỉ hiển thị mức âm lượng hiện tại
        if (muc === null) {
            return interaction.reply(`🔊 Âm lượng hiện tại: **${queue.volume}%**`);
        }

        queue.setVolume(muc);
        await interaction.reply(`🔊 Đã chỉnh âm lượng thành **${muc}%**!`);
    },
};
