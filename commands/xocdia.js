'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../utils/economy');
const { placeBet, settleWin, settleLoss, refundBet } = require('../utils/games');
const { COLORS } = require('../utils/ui');
const logger = require('../utils/logger');

const GAME = 'xocdia';
// Trả 0.9:1 khi thắng (tổng 1.9x vốn) — phí sòng 5%.
const PAYOUT = 1.9;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xocdia')
        .setDescription('Xóc Đĩa — đặt Chẵn hoặc Lẻ (trả 0.9:1)')
        .addStringOption((o) =>
            o.setName('lua_chon').setDescription('Chẵn hoặc Lẻ').setRequired(true)
                .addChoices(
                    { name: '🔴 Chẵn (0, 2, 4 đỏ)', value: 'chan' },
                    { name: '⚪ Lẻ (1, 3 đỏ)', value: 'le' },
                ))
        .addIntegerOption((o) =>
            o.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50)),

    async execute(interaction) {
        const choice = interaction.options.getString('lua_chon', true);
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
                    .setTitle('🍽️ Xóc Đĩa')
                    .setDescription(`🫙 **Đang xóc...**\nCược **${stake.toLocaleString()} xu** → **${choice === 'chan' ? '🔴 Chẵn' : '⚪ Lẻ'}**`)],
            });

            await new Promise((r) => setTimeout(r, 1200));

            const coins = [];
            let red = 0;
            for (let i = 0; i < 4; i++) {
                const isRed = Math.random() < 0.5;
                coins.push(isRed ? '🔴' : '⚪');
                if (isRed) red++;
            }
            const even = red % 2 === 0;
            const win = (even ? 'chan' : 'le') === choice;

            const balance = win
                ? settleWin(interaction.user.id, interaction.guildId, GAME, stake, PAYOUT)
                : settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            settled = true;

            const net = win ? Math.floor(stake * PAYOUT) - stake : -stake;
            const user = getOrCreateUser(interaction.user.id);

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(win ? COLORS.success : COLORS.danger)
                    .setTitle('🍽️ Xóc Đĩa')
                    .setDescription([
                        `🍽️ ${coins.join('  ')}`,
                        `Số đỏ: **${red}** → **${even ? '🔴 Chẵn' : '⚪ Lẻ'}**`,
                        '',
                        win ? `🎉 **Thắng!** +**${net.toLocaleString()} xu**` : `😢 **Thua!** -**${stake.toLocaleString()} xu**`,
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[xocdia]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: '❌ Lỗi — đã hoàn cược.', embeds: [] }).catch(() => null);
            else await interaction.reply({ content: '❌ Lỗi!', ephemeral: true }).catch(() => null);
        }
    },
};
