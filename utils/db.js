'use strict';

/**
 * db.js — kết nối SQLite duy nhất cho toàn bot + migration theo user_version.
 *
 * Vì better-sqlite3 chạy đồng bộ trong 1 process, mọi thao tác tiền tệ
 * phải đi qua transaction để tránh race condition giữa 2 lệnh slash.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const logger = require('./logger');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'economy.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

function columnExists(table, column) {
    return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function migrate() {
    let version = db.pragma('user_version', { simple: true });

    if (version < 1) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id      TEXT PRIMARY KEY,
                username     TEXT NOT NULL DEFAULT '',
                balance      INTEGER NOT NULL DEFAULT 0,
                last_daily   TEXT DEFAULT NULL,
                total_earned INTEGER NOT NULL DEFAULT 0,
                total_lost   INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL DEFAULT (datetime('now'))
            );
        `);
        if (!columnExists('users', 'daily_streak')) {
            db.exec(`ALTER TABLE users ADD COLUMN daily_streak INTEGER NOT NULL DEFAULT 0`);
        }
        if (!columnExists('users', 'updated_at')) {
            db.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT`);
        }
        db.pragma('user_version = 1');
        version = 1;
    }

    if (version < 2) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       TEXT NOT NULL,
                guild_id      TEXT,
                amount        INTEGER NOT NULL,
                type          TEXT NOT NULL,
                game          TEXT,
                meta          TEXT,
                balance_after INTEGER,
                created_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, id DESC);
            CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at);

            CREATE TABLE IF NOT EXISTS game_stats (
                user_id    TEXT NOT NULL,
                guild_id   TEXT NOT NULL,
                game       TEXT NOT NULL,
                wins       INTEGER NOT NULL DEFAULT 0,
                losses     INTEGER NOT NULL DEFAULT 0,
                draws      INTEGER NOT NULL DEFAULT 0,
                plays      INTEGER NOT NULL DEFAULT 0,
                total_won  INTEGER NOT NULL DEFAULT 0,
                total_lost INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (user_id, guild_id, game)
            );
        `);
        db.pragma('user_version = 2');
        version = 2;
    }

    if (version < 3) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id               TEXT PRIMARY KEY,
                embed_color            INTEGER NOT NULL DEFAULT 5793266,
                dj_role_id             TEXT,
                default_volume         INTEGER NOT NULL DEFAULT 50,
                max_queue              INTEGER NOT NULL DEFAULT 100,
                idle_timeout           INTEGER NOT NULL DEFAULT 600,
                autoplay               INTEGER NOT NULL DEFAULT 0,
                mode_247               INTEGER NOT NULL DEFAULT 0,
                log_channel_id         TEXT,
                music_channel_id       TEXT,
                temp_voice_category_id TEXT,
                temp_voice_channel_id  TEXT,
                study_category_id      TEXT,
                updated_at             TEXT
            );

            CREATE TABLE IF NOT EXISTS playlists (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    TEXT NOT NULL,
                name       TEXT NOT NULL,
                songs      TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE (user_id, name)
            );
            CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
        `);
        db.pragma('user_version = 3');
        version = 3;
    }

    if (version < 4) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS board_games (
                id            TEXT PRIMARY KEY,
                guild_id      TEXT NOT NULL,
                channel_id    TEXT NOT NULL,
                message_id    TEXT,
                game_type     TEXT NOT NULL,
                player1_id    TEXT NOT NULL,
                player2_id    TEXT NOT NULL,
                player1_name  TEXT,
                player2_name  TEXT,
                state         TEXT NOT NULL,
                turn          TEXT NOT NULL,
                status        TEXT NOT NULL DEFAULT 'active',
                winner_id     TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_board_lookup
                ON board_games(guild_id, channel_id, status);
            CREATE INDEX IF NOT EXISTS idx_board_players
                ON board_games(guild_id, player1_id, player2_id, status);

            CREATE TABLE IF NOT EXISTS board_stats (
                user_id   TEXT NOT NULL,
                guild_id  TEXT NOT NULL,
                game_type TEXT NOT NULL,
                wins      INTEGER NOT NULL DEFAULT 0,
                losses    INTEGER NOT NULL DEFAULT 0,
                draws     INTEGER NOT NULL DEFAULT 0,
                elo       INTEGER NOT NULL DEFAULT 1000,
                PRIMARY KEY (user_id, guild_id, game_type)
            );
        `);
        db.pragma('user_version = 4');
        version = 4;
    }

    if (version < 5) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS voice_sessions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id     TEXT NOT NULL,
                user_id      TEXT NOT NULL,
                channel_id   TEXT NOT NULL,
                channel_name TEXT,
                joined_at    INTEGER NOT NULL,
                left_at      INTEGER,
                study        INTEGER NOT NULL DEFAULT 0,
                subject      TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_voice_user
                ON voice_sessions(guild_id, user_id, joined_at);
            CREATE INDEX IF NOT EXISTS idx_voice_open
                ON voice_sessions(guild_id, user_id, left_at);

            CREATE TABLE IF NOT EXISTS temp_channels (
                channel_id TEXT PRIMARY KEY,
                guild_id   TEXT NOT NULL,
                owner_id   TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS study_sessions (
                id                TEXT PRIMARY KEY,
                guild_id          TEXT NOT NULL,
                channel_id        TEXT NOT NULL,
                notify_channel_id TEXT,
                subject           TEXT,
                duration_min      INTEGER NOT NULL,
                host_id           TEXT NOT NULL,
                started_at        INTEGER NOT NULL,
                ends_at           INTEGER NOT NULL,
                active            INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_study_active
                ON study_sessions(guild_id, active);
        `);
        db.pragma('user_version = 5');
        version = 5;
    }

    if (version < 6) {
        db.exec(`
            CREATE TABLE IF NOT EXISTS poker_escrow (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id    TEXT NOT NULL,
                user_id    TEXT NOT NULL,
                amount     INTEGER NOT NULL,
                status     TEXT NOT NULL DEFAULT 'held',
                amount_out INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_escrow_status ON poker_escrow(status);
        `);
        db.pragma('user_version = 6');
        version = 6;
    }

    logger.info(`[db] Đã mở ${DB_PATH} (schema v${version})`);
}

migrate();

const transaction = (fn) => db.transaction(fn);

function close() {
    try {
        db.pragma('wal_checkpoint(TRUNCATE)');
    } catch (err) {
        logger.warn('[db] Không checkpoint được WAL:', err.message);
    }
    try {
        db.close();
        logger.info('[db] Đã đóng database an toàn.');
    } catch (err) {
        logger.warn('[db] Lỗi đóng database:', err.message);
    }
}

module.exports = { db, DB_PATH, transaction, close };
