const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../utils/economy');

// ─── /leaderboard-xu — Bảng xếp hạng xu ảo ──────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard-xu')
        .setDescription('Bảng xếp hạng ai nhiều xu ảo nhất nhóm!'),

    async execute(interaction) {
        try {
            const top = getLeaderboard(10);
            if (!top.length) {
                return interaction.reply({ content: '❌ Chưa có ai trong hệ thống xu!', ephemeral: true });
            }

            const medals = ['🥇', '🥈', '🥉'];
            const lines = top.map((u, i) => {
                const medal = medals[i] || `**#${i + 1}**`;
                return `${medal} **${u.username || 'Unknown'}** — ${u.balance.toLocaleString()} xu`;
            });

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('🏆 Bảng Xếp Hạng Xu Ảo')
                .setDescription(lines.join('\n'))
                .setFooter({ text: `Top ${top.length} người giàu nhất` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[leaderboard-xu.js ERROR]', error);
            await interaction.reply({ content: '❌ Lỗi khi lấy bảng xếp hạng!', ephemeral: true });
        }
    },
};
