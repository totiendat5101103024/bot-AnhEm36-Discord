'use strict';

/**
 * logger.js — log ra console + file, xoay theo ngày.
 * Không dùng thư viện ngoài. Lỗi ghi file sẽ tự tắt file logging
 * để không làm chết bot.
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
let currentDate = '';
let stream = null;
let fileLogging = true;

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
};

module.exports = logger;
