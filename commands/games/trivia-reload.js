'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const trivia = require('../../games/trivia');
const { formatCooldown } = require('../../games/triviaRewards');
const { successEmbed } = require('../../utils/ui');

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('trivia-reload')
        .setDescription('Nạp lại câu hỏi và cấu hình trivia (chỉ admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        const info = trivia.reload();
        const rewards = info.rewards.length ? info.rewards.join(' → ') : '0';

        await interaction.reply({
            embeds: [successEmbed(
                [
                    `📚 Câu hỏi hợp lệ: **${info.questions}**`,
                    `💰 Thưởng trong ngày: **${rewards} → 0 xu**`,
                    `⏱️ Cooldown: **${formatCooldown(info.cooldownSeconds * 1000)}**`,
                    `⌛ Thời gian trả lời: **${info.timeoutSeconds} giây**`,
                ].join('\n'),
                '✅ Đã nạp lại Trivia',
            )],
            ephemeral: true,
        });
    },
};
