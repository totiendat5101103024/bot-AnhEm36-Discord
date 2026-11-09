'use strict';

/**
 * eventLoader.js — nạp các file trong events/.
 * Mỗi file export { name, once?, execute }.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

function loadEvents(client) {
    const eventsPath = path.join(__dirname, '..', 'events');
    if (!fs.existsSync(eventsPath)) return 0;

    let loaded = 0;
    for (const file of fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'))) {
        const filePath = path.join(eventsPath, file);
        try {
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);
            const list = Array.isArray(event) ? event : [event];
            for (const item of list) {
                // Module "setup" (ví dụ DisTube) tự gắn handler, không phải event của client.
                if (item?.setup && typeof item.execute === 'function') {
                    item.execute(client);
                    loaded++;
                    continue;
                }
                if (!item?.name || typeof item.execute !== 'function') {
                    logger.warn(`[events] Bỏ qua ${file} (thiếu name/execute)`);
                    continue;
                }
                if (item.once) client.once(item.name, (...args) => item.execute(...args));
                else client.on(item.name, (...args) => item.execute(...args));
                loaded++;
            }
        } catch (err) {
            logger.error(`[events] Lỗi nạp ${file}:`, err);
        }
    }

    logger.info(`[events] Đã nạp ${loaded} event.`);
    return loaded;
}

module.exports = { loadEvents };
