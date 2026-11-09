const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { claimDaily, getOrCreateUser } = require('../utils/economy');

// ─── /daily — Nhận thưởng xu ảo mỗi 24h ─────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Nhận thưởng xu ảo hàng ngày (mỗi 24 giờ)'),

    async execute(interaction) {
        try {
            const result = claimDaily(interaction.user.id, interaction.user.username);

            const embed = new EmbedBuilder()
                .setColor(result.success ? 0x00FF88 : 0xFF6B6B)
                .setTitle(result.success ? '🎁 Thưởng Hàng Ngày!' : '⏳ Đã Nhận Rồi!')
                .setDescription(result.message)
                .addFields(
                    { name: '💵 Số dư hiện tại', value: `**${result.newBalance.toLocaleString()}** xu`, inline: true },
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[daily.js ERROR]', error);
            await interaction.reply({ content: '❌ Có lỗi khi nhận thưởng!', ephemeral: true });
        }
    },
};
