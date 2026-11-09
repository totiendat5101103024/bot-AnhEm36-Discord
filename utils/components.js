'use strict';

/**
 * components.js — router cho button / select menu / modal.
 *
 * Mỗi module đăng ký một prefix (phần trước dấu ':' đầu tiên).
 * Ví dụ customId "music:pause" → handler prefix "music".
 */

const logger = require('./logger');

const handlers = new Map();

function register(prefix, handler) {
    if (typeof handler !== 'function') throw new Error(`Handler cho "${prefix}" phải là function`);
    if (handlers.has(prefix)) {
        logger.warn(`[components] Ghi đè handler cho prefix "${prefix}"`);
    }
    handlers.set(prefix, handler);
}

async function route(interaction) {
    const customId = interaction.customId || '';
    const prefix = customId.split(':', 1)[0];
    const handler = handlers.get(prefix);
    if (!handler) {
        logger.debug(`[components] Không có handler cho "${customId}"`);
        return false;
    }
    await handler(interaction, customId.split(':').slice(1));
    return true;
}

module.exports = { register, route, handlers };
