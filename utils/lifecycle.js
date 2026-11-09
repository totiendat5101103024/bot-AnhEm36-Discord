'use strict';

/**
 * lifecycle.js — tắt bot êm ái và bắt lỗi toàn cục.
 * PM2 gửi SIGINT/SIGTERM khi restart; nếu không đóng SQLite WAL
 * thì database có thể hỏng sau nhiều lần restart.
 */

const logger = require('./logger');

const hooks = [];
let shuttingDown = false;

function onShutdown(fn) {
    if (typeof fn === 'function') hooks.push(fn);
}

async function shutdown(signal, code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.warn(`Nhận tín hiệu ${signal} — đang tắt bot an toàn...`);

    for (const fn of hooks.reverse()) {
        try {
            await fn();
        } catch (err) {
            logger.error('Lỗi trong shutdown hook:', err);
        }
    }

    logger.info('Đã đóng tài nguyên. Tạm biệt!');
    logger.close();
    process.exit(code);
}

function install() {
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Không crash cả bot chỉ vì một promise lỗi (ví dụ gửi tin thiếu quyền).
    process.on('unhandledRejection', (reason) => {
        logger.error('unhandledRejection:', reason);
    });

    // uncaughtException: trạng thái process không còn đáng tin → tắt để PM2 restart.
    process.on('uncaughtException', (err) => {
        logger.error('uncaughtException:', err);
        shutdown('uncaughtException', 1);
    });
}

module.exports = { onShutdown, shutdown, install };
