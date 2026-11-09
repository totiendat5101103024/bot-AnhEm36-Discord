'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../utils/economy');
const { placeBet, settleWin, settleLoss, refundBet } = require('../utils/games');
const { COLORS } = require('../utils/ui');
const logger = require('../utils/logger');

const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '💎', '🍀', '⭐'];
const GAME = 'slots';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Máy slot 3 ô — 3 giống x5, 2 giống x1.5')
        .addIntegerOption((option) =>
            option.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50)),

    async execute(interaction) {
        const stake = interaction.options.getInteger('cuoc', true);

        const check = validateBet(interaction.user.id, stake, interaction.user.username);
        if (!check.valid) return interaction.reply({ content: check.message, ephemeral: true });

        const bet = placeBet(interaction.user.id, interaction.guildId, GAME, stake);
        if (!bet.ok) return interaction.reply({ content: bet.message, ephemeral: true });

        let settled = false;
        try {
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.warning)
                    .setTitle('🎰 Máy Slot')
                    .setDescription(`╔══════════╗\n║  ❓ ❓ ❓  ║\n╚══════════╝\n\n🎰 **Đang quay...** Cược **${stake.toLocaleString()} xu**`)
                    .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })],
            });

            await new Promise((r) => setTimeout(r, 1300));

            const results = [1, 2, 3].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
            const counts = {};
            for (const symbol of results) counts[symbol] = (counts[symbol] || 0) + 1;
            const maxCount = Math.max(...Object.values(counts));

            let multiplier = 0;
            let title = '😢 **Trượt!** Không có biểu tượng nào giống nhau.';
            let color = COLORS.danger;

            if (maxCount === 3) {
                multiplier = 5;
                title = '🎊 **JACKPOT!** 3 giống nhau — x5 cược!';
                color = COLORS.gold;
            } else if (maxCount === 2) {
                multiplier = 1.5;
                title = '🎉 **Trúng!** 2 giống nhau — x1.5 cược!';
                color = COLORS.success;
            }

            const balance = multiplier > 0
                ? settleWin(interaction.user.id, interaction.guildId, GAME, stake, multiplier)
                : settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            settled = true;

            const user = getOrCreateUser(interaction.user.id);
            const net = multiplier > 0 ? Math.floor(stake * multiplier) - stake : -stake;

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(color)
                    .setTitle('🎰 Máy Slot')
                    .setDescription([
                        '╔══════════╗',
                        `║  ${results.join('  ')}  ║`,
                        '╚══════════╝',
                        '',
                        title,
                        `${net >= 0 ? '📈' : '📉'} **${net >= 0 ? '+' : ''}${net.toLocaleString()} xu**`,
                        '',
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[slots]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            const msg = '❌ Có lỗi khi quay slot — đã hoàn cược.';
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: msg, embeds: [] }).catch(() => null);
            else await interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
        }
    },
};
