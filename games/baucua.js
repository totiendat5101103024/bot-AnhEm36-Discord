'use strict';

/**
 * baucua.js — engine Bầu Cua nhiều cửa cược.
 *
 * Mỗi cửa cược độc lập: trúng `n` viên thì lời `amount * n`
 * (payout = amount * (1 + n) để hoàn cả vốn), trượt thì mất `amount`.
 */

const GAME = 'baucua';
const SYMBOLS = [
    { key: 'bau', option: 'bầu', name: 'Bầu', emoji: '🍐' },
    { key: 'cua', option: 'cua', name: 'Cua', emoji: '🦀' },
    { key: 'tom', option: 'tôm', name: 'Tôm', emoji: '🦐' },
    { key: 'ca', option: 'cá', name: 'Cá', emoji: '🐟' },
    { key: 'ga', option: 'gà', name: 'Gà', emoji: '🐓' },
    { key: 'nai', option: 'nai', name: 'Nai', emoji: '🦌' },
];

function getSymbol(key) {
    return SYMBOLS.find((s) => s.key === key);
}

/** Lắc 3 xúc xắc, trả về mảng index 0..5. Có thể truyền rng để test. */
function rollDice(rng = Math.random) {
    return [0, 1, 2].map(() => Math.floor(rng() * SYMBOLS.length));
}

/**
 * Tính kết quả cho danh sách cửa cược.
 * @param {Array<{key: string, amount: number}>} bets
 * @param {number[]} [dice] mặc định tự lắc
 */
function evaluate(bets, dice = rollDice()) {
    const counts = new Map();
    for (const d of dice) {
        const key = SYMBOLS[d].key;
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    const lines = bets.map((b) => {
        const matches = counts.get(b.key) || 0;
        return {
            key: b.key,
            symbol: getSymbol(b.key),
            amount: b.amount,
            matches,
            profit: matches > 0 ? b.amount * matches : -b.amount,
            payout: matches > 0 ? b.amount * (1 + matches) : 0,
        };
    });

    const totalStake = lines.reduce((sum, line) => sum + line.amount, 0);
    const totalPayout = lines.reduce((sum, line) => sum + line.payout, 0);

    return {
        dice,
        lines,
        totalStake,
        totalPayout,
        net: totalPayout - totalStake,
    };
}

/** Cộng thưởng và ghi thống kê 1 lần cho cả ván. Trả về số dư mới. */
function settle(userId, guildId, result) {
    const economy = require('../utils/economy');

    if (result.totalPayout > 0) {
        economy.credit(userId, result.totalPayout, {
            type: 'bet_win',
            game: GAME,
            guildId,
        });
    }

    const outcome = result.net > 0 ? 'win' : result.net < 0 ? 'loss' : 'draw';
    economy.recordGame(userId, guildId, GAME, outcome, Math.abs(result.net));

    return economy.getBalance(userId);
}

module.exports = { GAME, SYMBOLS, getSymbol, rollDice, evaluate, settle };
