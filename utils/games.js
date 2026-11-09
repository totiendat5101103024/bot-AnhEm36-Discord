'use strict';

/**
 * games.js — helper chung cho mọi game cược.
 */

const economy = require('./economy');

function placeBet(userId, guildId, game, amount) {
    return economy.tryDebit(userId, amount, {
        type: 'bet',
        game,
        guildId,
    });
}

/**
 * Trả thưởng theo bội số của cược. Payout đã bao gồm vốn.
 * Trả về số dư mới.
 */
function settleWin(userId, guildId, game, stake, multiplier) {
    const payout = Math.floor(stake * multiplier);
    if (payout > 0) {
        economy.credit(userId, payout, { type: 'bet_win', game, guildId });
    }
    economy.recordGame(userId, guildId, game, 'win', Math.max(0, payout - stake));
    return economy.getBalance(userId);
}

function settleLoss(userId, guildId, game, stake) {
    economy.recordGame(userId, guildId, game, 'loss', stake);
    return economy.getBalance(userId);
}

function settleDraw(userId, guildId, game, stake) {
    if (stake > 0) economy.refund(userId, stake, { type: 'refund', game, guildId });
    economy.recordGame(userId, guildId, game, 'draw', 0);
    return economy.getBalance(userId);
}

function refundBet(userId, guildId, game, stake) {
    if (stake > 0) economy.refund(userId, stake, { type: 'refund', game, guildId });
    return economy.getBalance(userId);
}

module.exports = { placeBet, settleWin, settleLoss, settleDraw, refundBet };
