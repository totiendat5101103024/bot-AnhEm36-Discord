'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../utils/economy');
const { placeBet, settleWin, settleLoss, refundBet } = require('../utils/games');
const { COLORS } = require('../utils/ui');
const logger = require('../utils/logger');

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const GAME = 'taixiu';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('taixiu')
        .setDescription('Chơi Tài Xỉu — đặt cược vào Tài hoặc Xỉu')
        .addStringOption((option) =>
            option.setName('lua_chon')
                .setDescription('Tài (tổng 11-17) hoặc Xỉu (tổng 4-10)')
                .setRequired(true)
                .addChoices(
                    { name: '🔴 Tài (11-17)', value: 'tai' },
                    { name: '🔵 Xỉu (4-10)', value: 'xiu' },
                ))
        .addIntegerOption((option) =>
            option.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50)),

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
                    .setTitle('🎲 Tài Xỉu')
                    .setDescription(`🫙 **Đang lắc...**\nCược **${stake.toLocaleString()} xu** vào **${choice === 'tai' ? '🔴 Tài' : '🔵 Xỉu'}**`)
                    .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })],
            });

            await new Promise((r) => setTimeout(r, 1200));

            const dice = [1, 2, 3].map(() => Math.floor(Math.random() * 6) + 1);
            const total = dice.reduce((a, b) => a + b, 0);
            const isBao = dice[0] === dice[1] && dice[1] === dice[2];
            const result = total >= 11 ? 'tai' : 'xiu';
            const win = !isBao && result === choice;

            if (isBao) settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            else if (win) settleWin(interaction.user.id, interaction.guildId, GAME, stake, 2);
            else settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            settled = true;

            const user = getOrCreateUser(interaction.user.id);
            const title = isBao
                ? `🌀 BÃO! (3 con ${dice[0]}) — nhà cái thắng!`
                : win
                    ? `🎉 ${choice === 'tai' ? 'TÀI' : 'XỈU'} — bạn thắng!`
                    : `😢 ${result === 'tai' ? 'TÀI' : 'XỈU'} — bạn thua!`;

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(isBao || !win ? COLORS.danger : COLORS.success)
                    .setTitle('🎲 Tài Xỉu')
                    .setDescription([
                        dice.map((d) => DICE_EMOJI[d]).join('  '),
                        '',
                        `Tổng: **${total}** → **${result === 'tai' ? 'TÀI' : 'XỈU'}**${isBao ? ' 🌀 BÃO' : ''}`,
                        title,
                        '',
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[taixiu]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            const msg = '❌ Có lỗi khi chơi Tài Xỉu — đã hoàn cược.';
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: msg, embeds: [] }).catch(() => null);
            else await interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
        }
    },
};
