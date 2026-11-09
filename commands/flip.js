const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, addBalance, subtractBalance, getOrCreateUser } = require('../utils/economy');

// ─── /flip — Coinflip 50/50 ──────────────────────────────────

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Tung đồng xu — đặt cược 50/50, nhân đôi hoặc mất!')
        .addStringOption(option =>
            option.setName('mat')
                .setDescription('Chọn mặt đồng xu')
                .setRequired(true)
                .addChoices(
                    { name: '🌕 Ngửa (Heads)', value: 'heads' },
                    { name: '🌑 Sấp (Tails)', value: 'tails' },
                ))
        .addIntegerOption(option =>
            option.setName('cuoc')
                .setDescription('Số xu muốn đặt cược')
                .setRequired(true)
                .setMinValue(50)),

    async execute(interaction) {
        try {
            const mat = interaction.options.getString('mat');
            const cuoc = interaction.options.getInteger('cuoc');
            const check = validateBet(interaction.user.id, cuoc, interaction.user.username);
            if (!check.valid) {
                return interaction.reply({ content: check.message, ephemeral: true });
            }

            // Animation
            const loadingEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('🪙 Tung Đồng Xu')
                .setDescription(`🌀 **Đồng xu đang quay...**\n\n🎰 Cược: **${cuoc.toLocaleString()} xu** vào **${mat === 'heads' ? '🌕 Ngửa' : '🌑 Sấp'}**`)
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

            await interaction.reply({ embeds: [loadingEmbed] });
            await new Promise(r => setTimeout(r, 1200));

            // Kết quả
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const win = result === mat;

            if (win) {
                addBalance(interaction.user.id, cuoc);
            } else {
                subtractBalance(interaction.user.id, cuoc);
            }

            const user = getOrCreateUser(interaction.user.id);
            const resultEmoji = result === 'heads' ? '🌕' : '🌑';
            const resultText = result === 'heads' ? 'Ngửa' : 'Sấp';

            const resultEmbed = new EmbedBuilder()
                .setColor(win ? 0x00FF88 : 0xFF4444)
                .setTitle('🪙 Tung Đồng Xu')
                .setDescription([
                    `${resultEmoji} Kết quả: **${resultText}**!`,
                    ``,
                    win
                        ? `🎉 **Bạn thắng!** +**${cuoc.toLocaleString()} xu**`
                        : `😢 **Bạn thua!** -**${cuoc.toLocaleString()} xu**`,
                    ``,
                    `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                ].join('\n'))
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });
        } catch (error) {
            console.error('[flip.js ERROR]', error);
            const msg = '❌ Có lỗi khi tung đồng xu!';
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: msg, embeds: [] });
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
        }
    },
};
