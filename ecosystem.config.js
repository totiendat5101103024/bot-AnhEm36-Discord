'use strict';

/**
 * ecosystem.config.js — cấu hình PM2 cho bot chạy local.
 *
 *   pm2 start ecosystem.config.js
 *   pm2 logs sinhtondaihoc
 *   pm2 restart sinhtondaihoc
 */

module.exports = {
    apps: [
        {
            name: 'sinhtondaihoc',
            script: 'index.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            watch: false,
            max_memory_restart: '512M',
            // Cho bot thời gian đóng SQLite + rời voice trước khi PM2 kill.
            kill_timeout: 10_000,
            restart_delay: 3000,
            exp_backoff_restart_delay: 1000,
            time: true,
            env: {
                NODE_ENV: 'production',
            },
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            merge_logs: true,
        },
    ],
};
