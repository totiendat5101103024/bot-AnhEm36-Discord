'use strict';

/**
 * cooldowns.js — chống spam lệnh theo user + lệnh.
 */

const buckets = new Map();

function keyOf(userId, command) {
    return `${userId}:${command}`;
}

/**
 * Trả về { ok: true } nếu được dùng, hoặc { ok: false, retryIn } (ms).
 */
function check(userId, command, ms) {
    const key = keyOf(userId, command);
    const now = Date.now();
    const until = buckets.get(key) || 0;
    if (now < until) return { ok: false, retryIn: until - now };
    buckets.set(key, now + ms);
    return { ok: true };
}

function clear(userId, command) {
    buckets.delete(keyOf(userId, command));
}

// Dọn rác mỗi phút, unref để không giữ process sống.
const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [key, until] of buckets) {
        if (until <= now) buckets.delete(key);
    }
}, 60_000);
sweeper.unref();

module.exports = { check, clear };
