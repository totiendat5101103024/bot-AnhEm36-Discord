'use strict';

/**
 * helpView.js — dựng embed + select menu cho /help.
 */

const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { baseEmbed, COLORS, truncate } = require('./ui');
const { CATEGORY_LABELS, categoryLabel } = require('./commandLoader');

function groupCommands(client) {
    const groups = new Map();
    for (const command of client.commands.values()) {
        const category = command.category || 'util';
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category).push(command);
    }
    for (const list of groups.values()) {
        list.sort((a, b) => a.data.name.localeCompare(b.data.name));
    }
    return groups;
}

function buildHelpEmbed(client, category = 'all', user = null) {
    const groups = groupCommands(client);
    const total = [...groups.values()].reduce((sum, list) => sum + list.length, 0);

    const embed = baseEmbed({
        color: COLORS.primary,
        title: '📖 Danh sách lệnh',
        description: `Tổng **${total} lệnh**. Dùng \`/tên_lệnh\` để sử dụng.\nChọn nhóm bên dưới để xem chi tiết.`,
        footer: user ? `Yêu cầu bởi ${user.username}` : undefined,
    });

    const render = (key) => groups.get(key)
        .map((cmd) => `\`/${cmd.data.name}\` — ${truncate(cmd.data.description || 'Không có mô tả', 80)}`)
        .join('\n');

    if (category !== 'all' && groups.has(category)) {
        embed.addFields({
            name: categoryLabel(category),
            value: render(category).slice(0, 1024) || 'Chưa có lệnh.',
        });
    } else {
        for (const [key, list] of groups) {
            embed.addFields({
                name: `${categoryLabel(key)} (${list.length})`,
                value: list.slice(0, 12).map((cmd) => `\`/${cmd.data.name}\``).join(' · ')
                    + (list.length > 12 ? ` … +${list.length - 12}` : ''),
            });
        }
    }

    return embed;
}

function buildHelpSelect(client, selected = 'all') {
    const groups = groupCommands(client);
    const options = [
        { label: 'Tất cả', value: 'all', description: 'Xem tổng quan mọi nhóm lệnh' },
        ...[...groups.entries()].map(([key, list]) => ({
            label: (CATEGORY_LABELS[key] || key).replace(/^\S+\s/, ''),
            value: key,
            description: `${list.length} lệnh`,
            default: key === selected,
        })),
    ].slice(0, 25);

    const menu = new StringSelectMenuBuilder()
        .setCustomId('help:select')
        .setPlaceholder('Chọn nhóm lệnh')
        .addOptions(options);

    if (options.some((o) => o.value === selected)) {
        // StringSelectMenuBuilder không có setDefault cho từng option ở API mới,
        // nên chỉ đánh dấu qua placeholder.
        menu.setPlaceholder(`Đang xem: ${categoryLabel(selected === 'all' ? 'all' : selected)}`);
    }

    return new ActionRowBuilder().addComponents(menu);
}

module.exports = { buildHelpEmbed, buildHelpSelect, groupCommands };
