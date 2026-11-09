'use strict';

/**
 * logger.js — log ra console + file, xoay theo ngày.
 * Không dùng thư viện ngoài. Lỗi ghi file sẽ tự tắt file logging
 * để không làm chết bot.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const KEEP_DAYS = Math.max(1, Number(process.env.LOG_KEEP_DAYS) || 14);
const LOG_PATTERN = /^bot-\d{4}-\d{2}-\d{2}\.log$/;
const DAY_MS = 24 * 60 * 60 * 1000;

let currentDate = '';
let stream = null;
let fileLogging = true;
let lastPruneDate = '';

/**
 * Đưa file vào trash theo quy tắc không xoá vĩnh viễn.
 * Trả về true nếu đã chuyển được, false nếu không có `gio`.
 */
function trashFile(file) {
    try {
        const res = spawnSync('gio', ['trash', file], { stdio: 'ignore' });
        return res.status === 0;
    } catch {
        return false;
    }
}

/**
 * Dọn log cũ hơn KEEP_DAYS ngày. Không đụng file đang ghi
 * và không đụng log của PM2 (`pm2-*.log`).
 */
function pruneOldLogs(now = Date.now()) {
    const cutoff = now - KEEP_DAYS * DAY_MS;
    let removed = 0;
    let skipped = 0;
    let files;
    try {
        files = fs.readdirSync(LOG_DIR);
    } catch {
        return { removed, skipped };
    }

    const active = stream && stream.path ? String(stream.path) : null;
    for (const name of files) {
        if (!LOG_PATTERN.test(name)) continue;
        const full = path.join(LOG_DIR, name);
        if (active && path.resolve(full) === path.resolve(active)) continue;

        let stat;
        try {
            stat = fs.statSync(full);
        } catch {
            continue;
        }
        if (stat.mtimeMs >= cutoff) continue;

        if (trashFile(full)) {
            removed += 1;
        } else {
            skipped += 1;
            console.warn(`[logger] Không có gio để dọn log cũ: ${full}`);
        }
    }
    return { removed, skipped };
}

function ensureStream() {
    if (!fileLogging) return null;
    try {
        const date = new Date().toISOString().slice(0, 10);
        if (date !== currentDate || !stream) {
            if (stream) stream.end();
            fs.mkdirSync(LOG_DIR, { recursive: true });
            stream = fs.createWriteStream(path.join(LOG_DIR, `bot-${date}.log`), { flags: 'a' });
            stream.on('error', (err) => {
                fileLogging = false;
                console.error('[logger] Không ghi được file log:', err.message);
            });
            currentDate = date;

            // Mỗi ngày dọn log cũ một lần, ngay sau khi xoay file.
            if (lastPruneDate !== date) {
                lastPruneDate = date;
                const { removed, skipped } = pruneOldLogs();
                if (removed || skipped) {
                    console.log(`[logger] Dọn log: ${removed} đã vào trash, ${skipped} giữ lại (thiếu gio).`);
                }
            }
        }
        return stream;
    } catch (err) {
        fileLogging = false;
        console.error('[logger] Không mở được file log:', err.message);
        return null;
    }
}

function stringify(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function write(level, args) {
    const line = `[${new Date().toISOString()}] [${level}] ${args.map(stringify).join(' ')}`;
    if (level === 'ERROR') console.error(line);
    else if (level === 'WARN') console.warn(line);
    else console.log(line);

    const s = ensureStream();
    if (s) s.write(line + '\n');
}

const logger = {
    info: (...args) => write('INFO', args),
    warn: (...args) => write('WARN', args),
    error: (...args) => write('ERROR', args),
    debug: (...args) => {
        if (process.env.DEBUG) write('DEBUG', args);
    },
    close: () => {
        if (stream) {
            stream.end();
            stream = null;
        }
        fileLogging = false;
    },
    // Dùng cho test/QA.
    pruneOldLogs,
    KEEP_DAYS,
};

module.exports = logger;
