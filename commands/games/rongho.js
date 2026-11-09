'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../../utils/economy');
const { placeBet, settleWin, settleLoss, refundBet } = require('../../utils/games');
const { COLORS } = require('../../utils/ui');
const { freshShuffledDeck, draw, cardStr } = require('../../utils/cards');
const logger = require('../../utils/logger');

const GAME = 'rongho';

module.exports = {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('rongho')
        .setDescription('Rồng Hổ — đoán lá bài bên nào cao hơn (Hoà trả 8:1)')
        .addStringOption((o) => o
            .setName('cua')
            .setDescription('Đặt Rồng, Hổ hoặc Hoà')
            .setRequired(true)
            .addChoices(
                { name: '🐉 Rồng', value: 'dragon' },
                { name: '🐯 Hổ', value: 'tiger' },
                { name: '🤝 Hoà', value: 'tie' },
            ))
        .addIntegerOption((o) => o.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50).setMaxValue(5000)),

    async execute(interaction) {
        const choice = interaction.options.getString('cua', true);
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
                    .setTitle('🐉 Rồng Hổ')
                    .setDescription(`🃏 **Đang chia bài...**\nCược **${stake.toLocaleString()} xu** vào **${choice === 'dragon' ? 'Rồng' : choice === 'tiger' ? 'Hổ' : 'Hoà'}**`)],
            });
            await new Promise((r) => setTimeout(r, 1000));

            const deck = freshShuffledDeck();
            const dragon = draw(deck, 1);
            const tiger = draw(deck, 1);

            const outcome = dragon.r === tiger.r ? 'tie' : dragon.r > tiger.r ? 'dragon' : 'tiger';
            const win = choice === outcome;
            const multiplier = outcome === 'tie' ? 9 : 2;

            if (win) settleWin(interaction.user.id, interaction.guildId, GAME, stake, multiplier);
            else settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            settled = true;

            const user = getOrCreateUser(interaction.user.id);
            const net = win ? Math.floor(stake * multiplier) - stake : -stake;
            const outcomeLabel = outcome === 'dragon' ? '🐉 Rồng' : outcome === 'tiger' ? '🐯 Hổ' : '🤝 Hoà';

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(win ? COLORS.success : COLORS.danger)
                    .setTitle('🐉 Rồng Hổ')
                    .setDescription([
                        `🐉 Rồng: **${cardStr(dragon)}**`,
                        `🐯 Hổ:   **${cardStr(tiger)}**`,
                        '',
                        `Kết quả: **${outcomeLabel}**`,
                        win ? `🎉 Thắng **+${net.toLocaleString()} xu** (x${multiplier})` : `😢 Thua **-${stake.toLocaleString()} xu**`,
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[rongho]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: '❌ Lỗi — đã hoàn cược.', embeds: [] }).catch(() => null);
        }
    },
};
