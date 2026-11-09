'use strict';

/**
 * store.js — lưu ván board game vào SQLite + tính Elo.
 *
 * Bảng đã có từ schema v4:
 *  - board_games: trạng thái ván (state JSON), lượt đi, người thắng
 *  - board_stats: thắng/thua/hoà + Elo theo từng loại game
 */

const crypto = require('crypto');
const { db } = require('../../utils/db');

const K_FACTOR = 32;
const DEFAULT_ELO = 1000;

const insertGame = db.prepare(`
    INSERT INTO board_games
        (id, guild_id, channel_id, message_id, game_type,
         player1_id, player2_id, player1_name, player2_name,
         state, turn, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
`);

const selectGame = db.prepare('SELECT * FROM board_games WHERE id = ?');
const updateGameStmt = db.prepare(`
    UPDATE board_games
    SET state = ?, turn = ?, message_id = COALESCE(?, message_id),
        updated_at = datetime('now')
    WHERE id = ?
`);
const finishGameStmt = db.prepare(`
    UPDATE board_games
    SET state = ?, turn = ?, status = 'finished', winner_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
`);
const activeForUser = db.prepare(`
    SELECT * FROM board_games
    WHERE guild_id = ? AND status = 'active'
      AND (player1_id = ? OR player2_id = ?)
    ORDER BY created_at DESC LIMIT 1
`);
const activeInChannel = db.prepare(`
    SELECT * FROM board_games
    WHERE guild_id = ? AND channel_id = ? AND status = 'active'
    ORDER BY created_at DESC LIMIT 1
`);
const listActive = db.prepare(`
    SELECT * FROM board_games
    WHERE guild_id = ? AND status = 'active'
    ORDER BY updated_at DESC LIMIT ?
`);
const historyStmt = db.prepare(`
    SELECT * FROM board_games
    WHERE guild_id = ? AND status = 'finished'
      AND (player1_id = ? OR player2_id = ?)
      AND (? IS NULL OR game_type = ?)
    ORDER BY updated_at DESC LIMIT ?
`);

const insertStat = db.prepare(`
    INSERT OR IGNORE INTO board_stats (user_id, guild_id, game_type)
    VALUES (?, ?, ?)
`);
const getStat = db.prepare(`
    SELECT * FROM board_stats WHERE user_id = ? AND guild_id = ? AND game_type = ?
`);
const updateStat = db.prepare(`
    UPDATE board_stats
    SET wins = wins + ?, losses = losses + ?, draws = draws + ?, elo = ?
    WHERE user_id = ? AND guild_id = ? AND game_type = ?
`);
const topStats = db.prepare(`
    SELECT * FROM board_stats
    WHERE guild_id = ? AND (? IS NULL OR game_type = ?)
    ORDER BY elo DESC, wins DESC, user_id ASC
    LIMIT ?
`);
const allStats = db.prepare(`
    SELECT * FROM board_stats
    WHERE guild_id = ? AND user_id = ?
    ORDER BY game_type ASC
`);

function newId(type) {
    const rand = crypto.randomBytes(3).toString('hex');
    return `${type}-${Date.now().toString(36)}-${rand}`;
}

function createGame({
    guildId,
    channelId,
    gameType,
    player1,
    player2,
    state,
    turn,
}) {
    const id = newId(gameType);
    insertGame.run(
        id,
        guildId,
        channelId,
        null,
        gameType,
        player1.id,
        player2.id,
        player1.name || player1.username || player1.id,
        player2.name || player2.username || player2.id,
        JSON.stringify(state),
        turn,
    );
    return getGame(id);
}

function getGame(id) {
    const row = selectGame.get(id);
    if (!row) return null;
    let state = null;
    try {
        state = JSON.parse(row.state);
    } catch {
        state = null;
    }
    return { ...row, parsed: state };
}

function updateGame(id, { state, turn, messageId = null }) {
    updateGameStmt.run(
        JSON.stringify(state),
        turn,
        messageId,
        id,
    );
}

function playerName(row, userId) {
    if (row.player1_id === userId) return row.player1_name || userId;
    if (row.player2_id === userId) return row.player2_name || userId;
    return userId;
}

function calcElo(ratingA, ratingB, scoreA) {
    const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
    const expectedB = 1 - expectedA;
    return {
        a: Math.round(ratingA + K_FACTOR * (scoreA - expectedA)),
        b: Math.round(ratingB + K_FACTOR * ((1 - scoreA) - expectedB)),
    };
}

const applyResult = db.transaction((row, winnerId) => {
    const draw = !winnerId;
    const p1Score = draw ? 0.5 : winnerId === row.player1_id ? 1 : 0;

    insertStat.run(row.player1_id, row.guild_id, row.game_type);
    insertStat.run(row.player2_id, row.guild_id, row.game_type);
    const s1 = getStat.get(row.player1_id, row.guild_id, row.game_type);
    const s2 = getStat.get(row.player2_id, row.guild_id, row.game_type);
    const next = calcElo(s1.elo, s2.elo, p1Score);

    updateStat.run(
        draw ? 0 : winnerId === row.player1_id ? 1 : 0,
        draw ? 0 : winnerId === row.player1_id ? 0 : 1,
        draw ? 1 : 0,
        next.a,
        row.player1_id,
        row.guild_id,
        row.game_type,
    );
    updateStat.run(
        draw ? 0 : winnerId === row.player2_id ? 1 : 0,
        draw ? 0 : winnerId === row.player2_id ? 0 : 1,
        draw ? 1 : 0,
        next.b,
        row.player2_id,
        row.guild_id,
        row.game_type,
    );

    return {
        draw,
        winnerId: winnerId || null,
        elo: {
            player1: { before: s1.elo, after: next.a, delta: next.a - s1.elo },
            player2: { before: s2.elo, after: next.b, delta: next.b - s2.elo },
        },
    };
});

/**
 * Kết thúc ván + cập nhật Elo/thành tích trong 1 transaction.
 * winnerId = null nghĩa là hoà.
 */
function finishGame(id, { state, turn, winnerId = null }) {
    const row = getGame(id);
    if (!row) return null;
    if (row.status !== 'active') return { alreadyFinished: true, row };

    finishGameStmt.run(JSON.stringify(state), turn, winnerId, id);
    const result = applyResult(row, winnerId);
    return { ...result, row: getGame(id) };
}

function getActiveForUser(guildId, userId) {
    return getGame(activeForUser.get(guildId, userId, userId)?.id);
}

function getActiveInChannel(guildId, channelId) {
    return getGame(activeInChannel.get(guildId, channelId)?.id);
}

function listActiveGames(guildId, limit = 10) {
    return listActive.all(guildId, limit).map((row) => getGame(row.id));
}

function getHistory(guildId, userId, gameType = null, limit = 10) {
    return historyStmt.all(guildId, userId, userId, gameType, gameType, limit)
        .map((row) => getGame(row.id));
}

function getStats(guildId, userId) {
    return allStats.all(guildId, userId);
}

function getStatOf(guildId, userId, gameType) {
    insertStat.run(userId, guildId, gameType);
    return getStat.get(userId, guildId, gameType);
}

function getRank(guildId, gameType = null, limit = 10) {
    return topStats.all(guildId, gameType, gameType, limit);
}

module.exports = {
    DEFAULT_ELO,
    createGame,
    getGame,
    updateGame,
    finishGame,
    getActiveForUser,
    getActiveInChannel,
    listActiveGames,
    getHistory,
    getStats,
    getStatOf,
    getRank,
    playerName,
    calcElo,
};
