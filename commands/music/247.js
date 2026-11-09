'use strict';

const { SlashCommandBuilder } = require('discord.js');
const settings = require('../../utils/settings');
const { isAdmin, safeError } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Bật/tắt chế độ bot ở lại voice 24/7 (không tự rời khi trống)'),

    async execute(interaction) {
        const current = settings.get(interaction.guildId);
        const dj = current.dj_role_id && interaction.member.roles.cache.has(current.dj_role_id);
        if (!isAdmin(interaction.member) && !dj) {
            return safeError(interaction, 'Chỉ admin hoặc role DJ mới bật/tắt 24/7!');
        }

        const next = current.mode_247 ? 0 : 1;
        settings.set(interaction.guildId, { mode_247: next });

        await interaction.reply(next
            ? '📌 Đã **bật 24/7** — bot sẽ không tự rời voice khi hết nhạc hoặc kênh trống.'
            : '📌 Đã **tắt 24/7** — bot sẽ rời voice khi hết nhạc/kênh trống.');
    },
};
