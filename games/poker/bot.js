'use strict';

/**
 * bot.js — quyết định cho bot heads-up bằng Monte Carlo equity.
 * Chỉ dùng cho chế độ /pokerbot (2 người), không can thiệp ván nhiều người.
 */

const { createDeck } = require('../../utils/cards');
const { evaluate, compare } = require('./evaluator');

const ITERATIONS = 220;

/**
 * Ước lượng xác suất thắng trước 1 đối thủ ngẫu nhiên.
 * Trả về 0..1 (hoà tính nửa trận).
 */
function equity(hole, community, iterations = ITERATIONS) {
    const known = [...hole, ...community];
    const pool = createDeck().filter(
        (c) => !known.some((k) => k.r === c.r && k.s === c.s),
    );
    const needOpp = 2;
    const needBoard = 5 - community.length;
    const need = needOpp + needBoard;

    if (pool.length < need) return 0.5;

    let score = 0;
    for (let it = 0; it < iterations; it++) {
        // Lấy mẫu không hoàn lại bằng partial Fisher-Yates.
        const copy = pool.slice();
        for (let i = 0; i < need; i++) {
            const j = i + Math.floor(Math.random() * (copy.length - i));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        const opp = copy.slice(0, needOpp);
        const board = community.concat(copy.slice(needOpp, need));
        const mine = evaluate([...hole, ...board]);
        const theirs = evaluate([...opp, ...board]);
        const cmp = compare(mine, theirs);
        if (cmp > 0) score += 1;
        else if (cmp === 0) score += 0.5;
    }
    return score / iterations;
}

/**
 * Chọn hành động dựa trên equity + pot odds.
 * game: { currentBet, pot, players, minRaise }
 * player: { bet, stack, cards }
 */
function decide(game, player) {
    const totalBets = game.players.reduce((s, p) => s + p.bet, 0);
    const pot = game.pot + totalBets;
    const toCall = Math.max(0, game.currentBet - player.bet);
    const eq = equity(player.cards, game.community);

    const maxTo = player.bet + player.stack;
    const minRaiseTo = Math.min(maxTo, game.currentBet + game.minRaise);

    if (toCall === 0) {
        if (eq > 0.75 || (eq > 0.58 && Math.random() < 0.45)) {
            return { type: 'raise', amount: minRaiseTo };
        }
        return { type: 'check' };
    }

    const potOdds = pot + toCall > 0 ? toCall / (pot + toCall) : 0;

    if (eq < potOdds - 0.03 && eq < 0.42) return { type: 'fold' };
    if (eq > 0.78 && player.stack > toCall && Math.random() < 0.7) {
        return { type: 'raise', amount: minRaiseTo };
    }
    return { type: 'call' };
}

module.exports = { equity, decide };
