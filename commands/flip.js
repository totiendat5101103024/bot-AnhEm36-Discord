'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, getOrCreateUser } = require('../utils/economy');
const { placeBet, settleWin, settleLoss, refundBet } = require('../utils/games');
const { COLORS } = require('../utils/ui');
const logger = require('../utils/logger');

const GAME = 'flip';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Tung đồng xu 50/50 — thắng nhân đôi')
        .addStringOption((option) =>
            option.setName('mat').setDescription('Chọn mặt').setRequired(true)
                .addChoices(
                    { name: '🌕 Ngửa (Heads)', value: 'heads' },
                    { name: '🌑 Sấp (Tails)', value: 'tails' },
                ))
        .addIntegerOption((option) =>
            option.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50)),

    async execute(interaction) {
        const choice = interaction.options.getString('mat', true);
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
                    .setTitle('🪙 Tung Đồng Xu')
                    .setDescription(`🌀 **Đang tung...**\nCược **${stake.toLocaleString()} xu** vào **${choice === 'heads' ? '🌕 Ngửa' : '🌑 Sấp'}**`)],
            });

            await new Promise((r) => setTimeout(r, 1000));

            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const win = result === choice;

            if (win) settleWin(interaction.user.id, interaction.guildId, GAME, stake, 2);
            else settleLoss(interaction.user.id, interaction.guildId, GAME, stake);
            settled = true;

            const user = getOrCreateUser(interaction.user.id);
            const resultText = result === 'heads' ? '🌕 Ngửa' : '🌑 Sấp';

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(win ? COLORS.success : COLORS.danger)
                    .setTitle('🪙 Tung Đồng Xu')
                    .setDescription([
                        `Kết quả: **${resultText}**`,
                        '',
                        win ? `🎉 **Thắng!** +**${stake.toLocaleString()} xu**` : `😢 **Thua!** -**${stake.toLocaleString()} xu**`,
                        `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                    ].join('\n'))
                    .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp()],
            });
        } catch (err) {
            logger.error('[flip]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, stake);
            if (interaction.replied || interaction.deferred) await interaction.editReply({ content: '❌ Lỗi — đã hoàn cược.', embeds: [] }).catch(() => null);
            else await interaction.reply({ content: '❌ Lỗi!', ephemeral: true }).catch(() => null);
        }
    },
};
