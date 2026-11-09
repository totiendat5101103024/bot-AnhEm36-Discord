'use strict';

/**
 * cards.js — bộ bài tây dùng chung cho poker, blackjack, rồng hổ, hi-lo.
 *
 * Card: { r: 2..14 (14 = A), s: 0..3 }
 * Suit: 0 ♠, 1 ♥, 2 ♦, 3 ♣
 */

const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

function rankLabel(r) {
    return RANK_LABEL[r] || String(r);
}

function cardStr(card) {
    if (!card) return '🂠';
    return `${rankLabel(card.r)}${SUITS[card.s]}`;
}

function cardsStr(cards, sep = ' ') {
    return cards.map(cardStr).join(sep);
}

function createDeck() {
    const deck = [];
    for (let s = 0; s < 4; s++) {
        for (let r = 2; r <= 14; r++) deck.push({ r, s });
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function freshShuffledDeck() {
    return shuffle(createDeck());
}

/** Rút n lá; ném lỗi nếu hết bài (không xảy ra với 1 bộ 52 lá). */
function draw(deck, n = 1) {
    if (deck.length < n) throw new Error('Bộ bài đã hết!');
    return n === 1 ? deck.pop() : deck.splice(-n, n).reverse();
}

/** Tổng điểm blackjack: A = 11 hoặc 1, tối ưu không vượt 21. */
function blackjackValue(cards) {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
        if (c.r === 14) {
            aces++;
            total += 11;
        } else {
            total += Math.min(c.r, 10);
        }
    }
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function isBlackjack(cards) {
    return cards.length === 2 && blackjackValue(cards) === 21;
}

module.exports = {
    SUITS,
    rankLabel,
    cardStr,
    cardsStr,
    createDeck,
    shuffle,
    freshShuffledDeck,
    draw,
    blackjackValue,
    isBlackjack,
};
