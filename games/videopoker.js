'use strict';

/**
 * videopoker.js — Video Poker "Jacks or Better" 5 lá, giữ/đổi bài.
 * Bảng trả thưởng tính theo bội số của cược (đã gồm vốn).
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economy = require('../utils/economy');
const { placeBet, settleWin, settleLoss, settleDraw } = require('../utils/games');
const { baseEmbed, errorEmbed, COLORS, truncate } = require('../utils/ui');
const { freshShuffledDeck, draw, cardStr } = require('../utils/cards');
const { evaluate, handName } = require('./poker/evaluator');
const logger = require('../utils/logger');

const sessions = new Map();
const GAME = 'videopoker';

const PAYTABLE = [
    { label: 'Thùng phá sảnh rồng', mult: 250 },
    { label: 'Thùng phá sảnh', mult: 50 },
    { label: 'Tứ quý', mult: 25 },
    { label: 'Cù lũ', mult: 9 },
    { label: 'Thùng', mult: 6 },
    { label: 'Sảnh', mult: 4 },
    { label: 'Sám cô', mult: 3 },
    { label: 'Hai đôi', mult: 2 },
    { label: 'Đôi J trở lên', mult: 1 },
];

function payoutOf(cards) {
    const hand = evaluate(cards);
    if (hand.cat === 8) return hand.tie[0] === 14 ? 250 : 50;
    if (hand.cat === 7) return 25;
    if (hand.cat === 6) return 9;
    if (hand.cat === 5) return 6;
    if (hand.cat === 4) return 4;
    if (hand.cat === 3) return 3;
    if (hand.cat === 2) return 2;
    if (hand.cat === 1 && hand.tie[0] >= 11) return 1;
    return 0;
}

function render(session) {
    const lines = session.cards.map((c, i) => {
        const held = session.held[i] ? '🔒' : '▫️';
        return `${held} **${i + 1}.** ${cardStr(c)}`;
    }).join('\n');

    const embed = baseEmbed({
        color: session.done ? (session.mult > 1 ? COLORS.success : session.mult === 1 ? COLORS.warning : COLORS.danger) : COLORS.primary,
        title: '🎰 Video Poker — Jacks or Better',
        description: [
            lines,
            '',
            session.status,
            session.done ? '' : '🔒 = giữ lại • bấm số để đổi trạng thái',
            `💰 Cược: **${session.bet.toLocaleString()} xu**`,
        ].filter(Boolean).join('\n'),
        footer: 'Thùng phá sảnh rồng 250x • Tứ quý 25x • Cù lũ 9x',
    });

    if (session.done) return { embeds: [embed], components: [] };

    const holdRow = new ActionRowBuilder();
    session.cards.forEach((c, i) => {
        holdRow.addComponents(new ButtonBuilder()
            .setCustomId(`vp:hold:${session.id}:${i}`)
            .setLabel(cardStr(c))
            .setStyle(session.held[i] ? ButtonStyle.Success : ButtonStyle.Secondary));
    });

    return {
        embeds: [embed],
        components: [
            holdRow,
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`vp:draw:${session.id}`).setLabel('Đổi bài & tính điểm').setEmoji('🔄').setStyle(ButtonStyle.Primary),
            ),
        ],
    };
}

async function start(interaction, bet) {
    const debit = placeBet(interaction.user.id, interaction.guildId, GAME, bet);
    if (!debit.ok) return interaction.reply({ embeds: [errorEmbed(debit.message)], ephemeral: true });

    const deck = freshShuffledDeck();
    const session = {
        id: `vp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        bet,
        deck,
        cards: draw(deck, 5),
        held: [false, false, false, false, false],
        done: false,
        status: 'Chọn lá muốn giữ rồi bấm **Đổi bài**.',
        mult: 0,
    };
    sessions.set(session.id, session);

    try {
        await interaction.reply(render(session));
    } catch (err) {
        logger.warn('[videopoker] không gửi được:', err.message);
        settleDraw(interaction.user.id, interaction.guildId, GAME, bet);
        sessions.delete(session.id);
    }
}

async function handleButton(interaction, action, sessionId, index) {
    const session = sessions.get(sessionId);
    if (!session) return interaction.reply({ content: '⌛ Ván video poker đã hết hạn.', ephemeral: true });
    if (session.userId !== interaction.user.id) {
        return interaction.reply({ content: 'Đây không phải ván của bạn!', ephemeral: true });
    }
    if (session.done) return interaction.reply({ content: 'Ván đã kết thúc.', ephemeral: true });

    if (action === 'hold') {
        const i = Number(index);
        if (!Number.isInteger(i) || i < 0 || i > 4) return;
        session.held[i] = !session.held[i];
        return interaction.update(render(session)).catch(() => null);
    }

    if (action !== 'draw') return;

    for (let i = 0; i < 5; i++) {
        if (!session.held[i]) session.cards[i] = draw(session.deck, 1);
    }

    const mult = payoutOf(session.cards);
    session.mult = mult;
    session.done = true;

    if (mult === 0) {
        settleLoss(session.userId, session.guildId, GAME, session.bet);
        session.status = `❌ **${handName(evaluate(session.cards))}** — không trúng gì.`;
    } else if (mult === 1) {
        settleDraw(session.userId, session.guildId, GAME, session.bet);
        session.status = `🤝 **${handName(evaluate(session.cards))}** — hoàn cược (x1).`;
    } else {
        settleWin(session.userId, session.guildId, GAME, session.bet, mult);
        session.status = `🎉 **${handName(evaluate(session.cards))}** — trả **x${mult}** (${(session.bet * mult).toLocaleString()} xu)!`;
    }

    const cleanup = setTimeout(() => sessions.delete(session.id), 10 * 60_000);
    cleanup.unref?.();

    return interaction.update(render(session)).catch(() => null);
}

module.exports = { start, handleButton, sessions, PAYTABLE };
