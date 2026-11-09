const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getOrCreateUser } = require('../utils/economy');

// ─── /balance — Xem số dư xu ảo ──────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Xem số dư xu ảo của bạn hoặc người khác')
        .addUserOption(option =>
            option.setName('nguoi_dung')
                .setDescription('Xem số dư của người khác (bỏ trống = xem của mình)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const target = interaction.options.getUser('nguoi_dung') || interaction.user;
            const user = getOrCreateUser(target.id, target.username);

            const embed = new EmbedBuilder()
                .setColor(0xFFD700) // Vàng gold
                .setTitle('💰 Ví Xu Ảo')
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '👤 Chủ sở hữu', value: target.username, inline: true },
                    { name: '💵 Số dư', value: `**${user.balance.toLocaleString()}** xu`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '📈 Tổng thắng', value: `${user.total_earned.toLocaleString()} xu`, inline: true },
                    { name: '📉 Tổng thua', value: `${user.total_lost.toLocaleString()} xu`, inline: true },
                    { name: '📊 Lãi/Lỗ ròng', value: `${(user.total_earned - user.total_lost).toLocaleString()} xu`, inline: true },
                )
                .setFooter({ text: 'Dùng /daily để nhận xu hàng ngày!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[balance.js ERROR]', error);
            await interaction.reply({ content: '❌ Có lỗi khi lấy số dư!', ephemeral: true });
        }
    },
};
