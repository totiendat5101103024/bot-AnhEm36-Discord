'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../../utils/economy');
const { placeBet, settleWin, settleLoss, settleDraw, refundBet } = require('../../utils/games');
const { COLORS } = require('../../utils/ui');
const { freshShuffledDeck, draw, cardStr } = require('../../utils/cards');
const logger = require('../../utils/logger');

const GAME = 'hilo';

module.exports = {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('hilo')
        .setDescription('Hi-Lo — đoán lá tiếp theo cao hơn hay thấp hơn (A lớn nhất)')
        .addStringOption((o) => o
            .setName('doan')
            .setDescription('Cao hơn hoặc thấp hơn')
            .setRequired(true)
            .addChoices(
                { name: '⬆️ Cao hơn', value: 'high' },
                { name: '⬇️ Thấp hơn', value: 'low' },
            ))
        .addIntegerOption((o) => o.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50).setMaxValue(5000)),

    async execute(interaction) {
        const guess = interaction.options.getString('doan', true);
        const stake = interaction.options.getInteger('cuoc', true);

        const check = validateBet(interaction.user.id, stake, interaction.user.username);
        if (!check.valid) return interaction.reply({ content: check.message, ephemeral: true });

        const bet = placeBet(interaction.user.id, interaction.guildId, GAME, stake);
        if (!bet.ok) return interaction.reply({ content: bet.message, ephemeral: true });

        let settled = false;
        try {
            const deck = freshShuffledDeck();
            const first = draw(deck, 1);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.warning)
                    .setTitle('🔼 Hi-Lo')
                    .setDescription(`Lá hiện tại: **${cardStr(first)}**\nBạn đoán lá tiếp theo **${guess === 'high' ? 'cao hơn ⬆️' : 'thấp hơn ⬇️'}** • cược **${stake.toLocaleString()} xu**`)],
            });
            await new Promise((r) => setTimeout(r, 900));

            const next = draw(deck, 1);
            let outcome;
            if (next.r === first.r) outcome = 'tie';
            else if (next.r > first.r) outcome = 'high';
            else outcome = 'low';

            if (outcome === 'tie') {
                settleDraw(interaction.user.id, interaction.guildId, GAME, stake);
            } else if (outcome === guess) {
                settleWin(interaction.user.id, interaction.guildId, GAME, stake, 1.9);
            } else {
                settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            }
            settled = true;

            const user = getOrCreateUser(interaction.user.id);
            const win = outcome === guess;
            const net = outcome === 'tie' ? 0 : win ? Math.floor(stake * 1.9) - stake : -stake;

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(outcome === 'tie' ? COLORS.warning : win ? COLORS.success : COLORS.danger)
                    .setTitle('🔼 Hi-Lo')
                    .setDescription([
                        `Lá đầu: **${cardStr(first)}**`,
                        `Lá tiếp: **${cardStr(next)}**`,
                        '',
                        outcome === 'tie'
                            ? '🤝 Hai lá bằng điểm — hoàn cược.'
                            : win
                                ? `🎉 Đoán đúng! **+${net.toLocaleString()} xu**`
                                : `😢 Đoán sai! **-${stake.toLocaleString()} xu**`,
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[hilo]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: '❌ Lỗi — đã hoàn cược.', embeds: [] }).catch(() => null);
        }
    },
};
