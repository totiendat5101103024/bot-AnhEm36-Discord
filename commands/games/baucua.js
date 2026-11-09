'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateUser } = require('../../utils/economy');
const { placeBet, refundBet } = require('../../utils/games');
const { baseEmbed, COLORS } = require('../../utils/ui');
const baucua = require('../../games/baucua');
const logger = require('../../utils/logger');

const GAME = baucua.GAME;
const SYMBOLS = baucua.SYMBOLS;

function betOptions(builder) {
    for (const s of SYMBOLS) {
        builder.addIntegerOption((o) => o
            .setName(s.option)
            .setDescription(`Số xu đặt vào ${s.name} ${s.emoji}`)
            .setMinValue(50)
            .setMaxValue(5000));
    }
    return builder;
}

function formatTicket(bets) {
    return bets
        .map((b) => {
            const s = baucua.getSymbol(b.key);
            return `${s.emoji} **${s.name}** — ${b.amount.toLocaleString()} xu`;
        })
        .join('\n');
}

function formatResult(result) {
    return result.lines
        .map((line) => {
            const sign = line.profit >= 0 ? '+' : '';
            const detail = line.matches > 0
                ? `trúng **${line.matches}** viên → ${sign}${line.profit.toLocaleString()} xu`
                : `trượt → ${line.profit.toLocaleString()} xu`;
            return `${line.symbol.emoji} **${line.symbol.name}** — ${detail}`;
        })
        .join('\n');
}

module.exports = {
    cooldown: 2,
    data: betOptions(new SlashCommandBuilder()
        .setName('baucua')
        .setDescription('Bầu Cua — đặt nhiều linh vật cùng lúc, mỗi viên trúng trả 1:1')),

    async execute(interaction) {
        const bets = SYMBOLS
            .map((s) => ({ key: s.key, amount: interaction.options.getInteger(s.option) || 0 }))
            .filter((b) => b.amount > 0);

        if (bets.length === 0) {
            return interaction.reply({
                content: '❌ Hãy đặt ít nhất một linh vật, ví dụ: `/baucua bau:500 cua:200`',
                ephemeral: true,
            });
        }

        const totalStake = bets.reduce((sum, b) => sum + b.amount, 0);
        const user = getOrCreateUser(interaction.user.id, interaction.user.username);
        if (user.balance < totalStake) {
            return interaction.reply({
                content: `❌ Bạn không đủ xu! Tổng cược **${totalStake.toLocaleString()} xu**, số dư: **${user.balance.toLocaleString()} xu**`,
                ephemeral: true,
            });
        }

        const bet = placeBet(interaction.user.id, interaction.guildId, GAME, totalStake);
        if (!bet.ok) return interaction.reply({ content: bet.message, ephemeral: true });

        let settled = false;
        try {
            await interaction.reply({
                embeds: [baseEmbed({
                    color: COLORS.warning,
                    title: '🎲 Bầu Cua',
                    description: `🫙 **Đang lắc...**\n\n${formatTicket(bets)}\n\n💰 Tổng cược: **${totalStake.toLocaleString()} xu**`,
                })],
            });
            await new Promise((r) => setTimeout(r, 1200));

            const result = baucua.evaluate(bets);
            const balance = baucua.settle(interaction.user.id, interaction.guildId, result);
            settled = true;

            const faces = result.dice.map((d) => SYMBOLS[d].emoji).join('  ');
            const netSign = result.net >= 0 ? '+' : '';
            const summary = result.net > 0
                ? `🎉 Lời **${netSign}${result.net.toLocaleString()} xu**`
                : result.net < 0
                    ? `😢 Lỗ **${result.net.toLocaleString()} xu**`
                    : '🤝 Hoà vốn';

            await interaction.editReply({
                embeds: [baseEmbed({
                    color: result.net > 0 ? COLORS.success : result.net < 0 ? COLORS.danger : COLORS.warning,
                    title: '🎲 Bầu Cua',
                    description: [
                        `🎲 ${faces}`,
                        '',
                        formatResult(result),
                        '',
                        `${summary} • 💵 Số dư: **${balance.toLocaleString()} xu**`,
                    ].join('\n'),
                })],
            });
        } catch (err) {
            logger.error('[baucua]', err);
            if (!settled) refundBet(interaction.user.id, interaction.guildId, GAME, totalStake);
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: '❌ Lỗi — đã hoàn cược.', embeds: [] }).catch(() => null);
            }
        }
    },
};
