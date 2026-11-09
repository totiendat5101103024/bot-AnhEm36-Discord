'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../../utils/economy');
const { placeBet, settleWin, settleLoss, settleDraw, refundBet } = require('../../utils/games');
const { COLORS } = require('../../utils/ui');
const logger = require('../../utils/logger');

const GAME = 'wheel';
const SEGMENTS = [0, 0.5, 1, 1.5, 2, 3, 5, 0];

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('wheel')
        .setDescription('Vòng quay may mắn — trúng tới x5 cược')
        .addIntegerOption((o) => o.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50).setMaxValue(5000)),

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
                    .setTitle('🎡 Vòng quay may mắn')
                    .setDescription(`🎡 **Đang quay...**\nCược **${stake.toLocaleString()} xu**\n\n${SEGMENTS.map((m) => `x${m}`).join(' • ')}`)],
            });
            await new Promise((r) => setTimeout(r, 1400));

            const index = Math.floor(Math.random() * SEGMENTS.length);
            const mult = SEGMENTS[index];

            if (mult === 0) settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            else if (mult === 1) settleDraw(interaction.user.id, interaction.guildId, GAME, stake);
            else settleWin(interaction.user.id, interaction.guildId, GAME, stake, mult);
            settled = true;

            const user = getOrCreateUser(interaction.user.id);
            const net = mult === 0 ? -stake : Math.floor(stake * mult) - stake;
            const pointer = SEGMENTS.map((m, i) => (i === index ? `**▶️x${m}◀️**` : `x${m}`)).join(' • ');

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(mult > 1 ? COLORS.success : mult === 1 ? COLORS.warning : COLORS.danger)
                    .setTitle('🎡 Vòng quay may mắn')
                    .setDescription([
                        pointer,
                        '',
                        mult === 0
                            ? '😢 Chúc bạn may mắn lần sau!'
                            : mult === 1
                                ? '🤝 Hoàn cược (x1).'
                                : `🎉 Trúng **x${mult}**! **+${net.toLocaleString()} xu**`,
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[wheel]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: '❌ Lỗi — đã hoàn cược.', embeds: [] }).catch(() => null);
        }
    },
};
