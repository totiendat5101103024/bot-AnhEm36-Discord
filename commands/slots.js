const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, addBalance, subtractBalance, getOrCreateUser } = require('../utils/economy');

// ─── /slots — Máy slot 3 ô emoji ─────────────────────────────
// Tỉ lệ thưởng:
//   3 giống nhau  → x5 cược
//   2 giống nhau  → x1.5 cược
//   Khác nhau hết → mất cược

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '🍀', '⭐'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Quay máy slot 3 ô — 3 giống x5, 2 giống x1.5!')
        .addIntegerOption(option =>
            option.setName('cuoc')
                .setDescription('Số xu muốn đặt cược')
                .setRequired(true)
                .setMinValue(50)),

    async execute(interaction) {
        try {
            const cuoc = interaction.options.getInteger('cuoc');
            const check = validateBet(interaction.user.id, cuoc, interaction.user.username);
            if (!check.valid) {
                return interaction.reply({ content: check.message, ephemeral: true });
            }

            // Animation: Spinning
            const loadingEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('🎰 Máy Slot')
                .setDescription([
                    `╔══════════╗`,
                    `║  ❓ ❓ ❓  ║`,
                    `╚══════════╝`,
                    ``,
                    `🎰 **Đang quay...** Cược: **${cuoc.toLocaleString()} xu**`,
                ].join('\n'))
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

            await interaction.reply({ embeds: [loadingEmbed] });
            await new Promise(r => setTimeout(r, 1500));

            // Kết quả random
            const results = [
                SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
                SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
                SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
            ];

            // Đếm biểu tượng giống nhau
            const counts = {};
            results.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
            const maxCount = Math.max(...Object.values(counts));

            let multiplier = 0;
            let resultTitle = '';
            let resultColor = 0xFF4444;

            if (maxCount === 3) {
                // JACKPOT — 3 giống nhau
                multiplier = 5;
                resultTitle = '🎊 **JACKPOT!** 3 giống nhau — x5 cược!';
                resultColor = 0xFFD700;
            } else if (maxCount === 2) {
                // 2 giống nhau
                multiplier = 1.5;
                resultTitle = '🎉 **Trúng!** 2 giống nhau — x1.5 cược!';
                resultColor = 0x00FF88;
            } else {
                // Thua
                multiplier = 0;
                resultTitle = '😢 **Trượt!** Không có biểu tượng nào giống nhau.';
            }

            let balanceChange = '';
            if (multiplier > 0) {
                const winnings = Math.floor(cuoc * multiplier) - cuoc; // Lãi ròng
                addBalance(interaction.user.id, winnings);
                balanceChange = `📈 **+${winnings.toLocaleString()} xu**`;
            } else {
                subtractBalance(interaction.user.id, cuoc);
                balanceChange = `📉 **-${cuoc.toLocaleString()} xu**`;
            }

            const user = getOrCreateUser(interaction.user.id);

            const resultEmbed = new EmbedBuilder()
                .setColor(resultColor)
                .setTitle('🎰 Máy Slot')
                .setDescription([
                    `╔══════════╗`,
                    `║  ${results[0]}  ${results[1]}  ${results[2]}  ║`,
                    `╚══════════╝`,
                    ``,
                    resultTitle,
                    balanceChange,
                    ``,
                    `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                ].join('\n'))
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });
        } catch (error) {
            console.error('[slots.js ERROR]', error);
            const msg = '❌ Có lỗi khi quay slot!';
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: msg, embeds: [] });
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
        }
    },
};
