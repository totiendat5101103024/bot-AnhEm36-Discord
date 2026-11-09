'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../../utils/economy');
const { placeBet, settleWin, settleLoss, refundBet } = require('../../utils/games');
const { COLORS } = require('../../utils/ui');
const logger = require('../../utils/logger');

const GAME = 'baucua';
const SYMBOLS = [
    { key: 'bau', name: 'Bầu', emoji: '🍐' },
    { key: 'cua', name: 'Cua', emoji: '🦀' },
    { key: 'tom', name: 'Tôm', emoji: '🦐' },
    { key: 'ca', name: 'Cá', emoji: '🐟' },
    { key: 'ga', name: 'Gà', emoji: '🐓' },
    { key: 'nai', name: 'Nai', emoji: '🦌' },
];

module.exports = {
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('baucua')
        .setDescription('Bầu Cua — đặt vào một linh vật, mỗi viên xúc xắc trúng trả 1:1')
        .addStringOption((o) => o
            .setName('linh_vat')
            .setDescription('Linh vật muốn đặt')
            .setRequired(true)
            .addChoices(...SYMBOLS.map((s) => ({ name: `${s.emoji} ${s.name}`, value: s.key }))))
        .addIntegerOption((o) => o.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50).setMaxValue(5000)),

    async execute(interaction) {
        const choice = interaction.options.getString('linh_vat', true);
        const stake = interaction.options.getInteger('cuoc', true);
        const symbol = SYMBOLS.find((s) => s.key === choice);

        const check = validateBet(interaction.user.id, stake, interaction.user.username);
        if (!check.valid) return interaction.reply({ content: check.message, ephemeral: true });

        const bet = placeBet(interaction.user.id, interaction.guildId, GAME, stake);
        if (!bet.ok) return interaction.reply({ content: bet.message, ephemeral: true });

        let settled = false;
        try {
            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(COLORS.warning)
                    .setTitle('🎲 Bầu Cua')
                    .setDescription(`🫙 **Đang lắc...**\nCược **${stake.toLocaleString()} xu** vào **${symbol.emoji} ${symbol.name}**`)],
            });
            await new Promise((r) => setTimeout(r, 1200));

            const dice = [0, 1, 2].map(() => Math.floor(Math.random() * SYMBOLS.length));
            const matches = dice.filter((d) => SYMBOLS[d].key === choice).length;
            const multiplier = 1 + matches;

            if (matches > 0) settleWin(interaction.user.id, interaction.guildId, GAME, stake, multiplier);
            else settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            settled = true;

            const user = getOrCreateUser(interaction.user.id);
            const net = matches > 0 ? stake * multiplier - stake : -stake;
            const faces = dice.map((d) => SYMBOLS[d].emoji).join('  ');

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(net >= 0 ? COLORS.success : COLORS.danger)
                    .setTitle('🎲 Bầu Cua')
                    .setDescription([
                        `🎲 ${faces}`,
                        `Trúng **${matches}** viên ${symbol.emoji} **${symbol.name}**`,
                        '',
                        matches > 0
                            ? `🎉 Thắng **+${net.toLocaleString()} xu** (x${multiplier})`
                            : `😢 Thua **-${stake.toLocaleString()} xu**`,
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[baucua]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: '❌ Lỗi — đã hoàn cược.', embeds: [] }).catch(() => null);
        }
    },
};
