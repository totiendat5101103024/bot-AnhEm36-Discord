'use strict';

/**
 * chuyenxu.js — chuyển xu từ ví của mình cho người khác.
 * Không thu phí, không giới hạn số xu mỗi lần (chỉ cần đủ số dư).
 */

const { SlashCommandBuilder } = require('discord.js');
const { transfer } = require('../utils/economy');
const { baseEmbed, COLORS } = require('../utils/ui');

module.exports = {
    cooldown: 3,
    data: new SlashCommandBuilder()
        .setName('chuyenxu')
        .setDescription('Chuyển xu từ ví của bạn cho người khác')
        .addUserOption((o) => o
            .setName('nguoi_nhan')
            .setDescription('Người nhận xu')
            .setRequired(true))
        .addIntegerOption((o) => o
            .setName('so_xu')
            .setDescription('Số xu muốn chuyển')
            .setRequired(true)
            .setMinValue(1))
        .addStringOption((o) => o
            .setName('ly_do')
            .setDescription('Lý do chuyển (không bắt buộc)')
            .setMaxLength(100)),

    async execute(interaction) {
        const target = interaction.options.getUser('nguoi_nhan', true);
        const amount = interaction.options.getInteger('so_xu', true);
        const reason = interaction.options.getString('ly_do');

        if (target.bot) {
            return interaction.reply({ content: '❌ Không thể chuyển xu cho bot!', ephemeral: true });
        }
        if (target.id === interaction.user.id) {
            return interaction.reply({ content: '❌ Không thể chuyển xu cho chính mình!', ephemeral: true });
        }

        const result = transfer(interaction.user.id, target.id, amount, {
            fromName: interaction.user.username,
            toName: target.username,
            guildId: interaction.guildId,
        });
        if (!result.ok) {
            return interaction.reply({ content: result.message, ephemeral: true });
        }

        const description = [
            `**${interaction.user.username}** → **${target.username}**`,
            `💵 **${amount.toLocaleString()} xu**`,
            reason ? `📝 ${reason}` : null,
        ].filter(Boolean).join('\n');

        await interaction.reply({
            embeds: [baseEmbed({
                color: COLORS.success,
                title: '💸 Chuyển xu thành công',
                description,
                fields: [
                    { name: '💳 Số dư của bạn', value: `${result.fromBalance.toLocaleString()} xu`, inline: true },
                    { name: '💰 Số dư người nhận', value: `${result.toBalance.toLocaleString()} xu`, inline: true },
                ],
            })],
        });
    },
};
