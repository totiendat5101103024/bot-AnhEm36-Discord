'use strict';

/**
 * blackjack.js — xì dách 1 người chơi với dealer.
 * Cược trừ ngay khi chia; Double trừ thêm đúng 1 lần cược.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economy = require('../utils/economy');
const { placeBet, settleWin, settleLoss, settleDraw, refundBet } = require('../utils/games');
const { baseEmbed, errorEmbed, COLORS } = require('../utils/ui');
const { freshShuffledDeck, draw, cardStr, cardsStr, blackjackValue, isBlackjack } = require('../utils/cards');
const logger = require('../utils/logger');

const sessions = new Map();
const GAME = 'blackjack';

function valueText(cards) {
    return blackjackValue(cards);
}

function render(session) {
    const pv = valueText(session.player);
    const dv = session.done ? valueText(session.dealer) : blackjackValue([session.dealer[0]]);

    const dealerText = session.done
        ? `${cardsStr(session.dealer)} = **${dv}**`
        : `${cardStr(session.dealer[0])} 🂠 = **${dv}+**`;
    const playerText = `${cardsStr(session.player)} = **${pv}**`;

    const embed = baseEmbed({
        color: session.done
            ? (session.outcome === 'win' || session.outcome === 'blackjack' ? COLORS.success
                : session.outcome === 'push' ? COLORS.warning : COLORS.danger)
            : COLORS.primary,
        title: '🃏 Blackjack',
        description: session.status,
        fields: [
            { name: '👤 Bạn', value: playerText, inline: false },
            { name: '🏦 Dealer', value: dealerText, inline: false },
            { name: '💰 Cược', value: `${session.totalBet.toLocaleString()} xu`, inline: true },
        ],
        footer: session.done ? 'Ván đã kết thúc' : 'Hit / Stand / Double',
    });

    const components = session.done ? [] : [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`blackjack:hit:${session.id}`).setLabel('Hit').setEmoji('➕').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`blackjack:stand:${session.id}`).setLabel('Stand').setEmoji('✋').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`blackjack:double:${session.id}`)
            .setLabel('Double')
            .setEmoji('💥')
            .setStyle(ButtonStyle.Success)
            .setDisabled(session.player.length !== 2 || session.doubled),
    )];

    return { embeds: [embed], components };
}

function finish(session) {
    session.done = true;
    const pv = valueText(session.player);
    const dv = valueText(session.dealer);
    const pBJ = isBlackjack(session.player);
    const dBJ = isBlackjack(session.dealer);

    let multiplier = 0;
    let outcome;
    let status;

    if (pv > 21) {
        outcome = 'lose';
        status = `💥 **Bù!** Bạn vượt 21 (${pv} điểm).`;
        settleLoss(session.userId, session.guildId, GAME, session.totalBet);
    } else if (pBJ && !dBJ) {
        outcome = 'blackjack';
        multiplier = 2.5;
        status = '🎉 **Blackjack!** Trả 3:2.';
        settleWin(session.userId, session.guildId, GAME, session.totalBet, multiplier);
    } else if (dBJ && !pBJ) {
        outcome = 'lose';
        status = '😢 Dealer có **Blackjack**.';
        settleLoss(session.userId, session.guildId, GAME, session.totalBet);
    } else if (dv > 21 || pv > dv) {
        outcome = 'win';
        multiplier = 2;
        status = dv > 21 ? `🎉 Dealer bù (${dv}) — bạn thắng!` : `🎉 **${pv}** > **${dv}** — bạn thắng!`;
        settleWin(session.userId, session.guildId, GAME, session.totalBet, multiplier);
    } else if (pv === dv) {
        outcome = 'push';
        status = `🤝 Hoà **${pv}** — hoàn cược.`;
        settleDraw(session.userId, session.guildId, GAME, session.totalBet);
    } else {
        outcome = 'lose';
        status = `😢 **${pv}** < **${dv}** — bạn thua.`;
        settleLoss(session.userId, session.guildId, GAME, session.totalBet);
    }

    session.outcome = outcome;
    session.status = status;
    session.multiplier = multiplier;
    session.balance = economy.getBalance(session.userId);
    sessions.set(session.id, session);

    const cleanup = setTimeout(() => sessions.delete(session.id), 10 * 60_000);
    cleanup.unref?.();
}

function dealerPlay(session) {
    while (valueText(session.dealer) < 17) {
        session.dealer.push(draw(session.deck, 1));
    }
}

async function start(interaction, bet) {
    const debit = placeBet(interaction.user.id, interaction.guildId, GAME, bet);
    if (!debit.ok) {
        return interaction.reply({ embeds: [errorEmbed(debit.message)], ephemeral: true });
    }

    const session = {
        id: `bj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        bet,
        totalBet: bet,
        deck: freshShuffledDeck(),
        player: [],
        dealer: [],
        doubled: false,
        done: false,
        status: 'Đang chia bài...',
        outcome: null,
    };

    session.player.push(draw(session.deck, 1), draw(session.deck, 1));
    session.dealer.push(draw(session.deck, 1), draw(session.deck, 1));

    if (isBlackjack(session.player) || isBlackjack(session.dealer)) {
        finish(session);
    } else {
        session.status = `Bài của bạn: **${valueText(session.player)}** điểm. Chọn hành động.`;
        sessions.set(session.id, session);
    }

    try {
        await interaction.reply(render(session));
    } catch (err) {
        logger.warn('[blackjack] không gửi được:', err.message);
        if (!session.done) refundBet(interaction.user.id, interaction.guildId, GAME, bet);
    }
}

async function handleButton(interaction, action, sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
        return interaction.reply({ content: '⌛ Ván blackjack đã hết hạn.', ephemeral: true });
    }
    if (session.userId !== interaction.user.id) {
        return interaction.reply({ content: 'Đây không phải ván của bạn!', ephemeral: true });
    }
    if (session.done) {
        return interaction.reply({ content: 'Ván đã kết thúc.', ephemeral: true });
    }

    if (action === 'double') {
        if (session.player.length !== 2 || session.doubled) {
            return interaction.reply({ content: 'Chỉ được Double khi còn đúng 2 lá ban đầu.', ephemeral: true });
        }
        const extra = economy.tryDebit(session.userId, session.bet, {
            type: 'bet', game: GAME, guildId: session.guildId,
        });
        if (!extra.ok) {
            return interaction.reply({ content: extra.message, ephemeral: true });
        }
        session.doubled = true;
        session.totalBet += session.bet;
    }

    if (action === 'hit' || action === 'double') {
        session.player.push(draw(session.deck, 1));
        const pv = valueText(session.player);
        if (pv > 21) {
            finish(session);
            return interaction.update(render(session)).catch(() => null);
        }
        if (action === 'double') {
            dealerPlay(session);
            finish(session);
            return interaction.update(render(session)).catch(() => null);
        }
        if (pv === 21) {
            dealerPlay(session);
            finish(session);
            return interaction.update(render(session)).catch(() => null);
        }
        session.status = `Bạn đang **${pv}** điểm. Hit hay Stand?`;
        sessions.set(session.id, session);
        return interaction.update(render(session)).catch(() => null);
    }

    // stand
    dealerPlay(session);
    finish(session);
    return interaction.update(render(session)).catch(() => null);
}

module.exports = { start, handleButton, sessions };
