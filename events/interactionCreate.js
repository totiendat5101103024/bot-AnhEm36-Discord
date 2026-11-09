'use strict';

/**
 * events/interactionCreate.js — router lệnh + component + chống spam.
 */

const logger = require('../utils/logger');
const cooldowns = require('../utils/cooldowns');
const components = require('../utils/components');
const { errorEmbed } = require('../utils/ui');

async function replyError(interaction, message) {
    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed(message)] });
        } else if (interaction.isRepliable()) {
            await interaction.reply({ embeds: [errorEmbed(message)], ephemeral: true });
        }
    } catch {
        // interaction đã hết hạn
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        try {
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    await replyError(interaction, 'Lệnh này không tồn tại hoặc chưa được deploy!');
                    return;
                }

                const cooldownMs = (command.cooldown ?? 2) * 1000;
                const cd = cooldowns.check(interaction.user.id, command.data.name, cooldownMs);
                if (!cd.ok) {
                    await interaction.reply({
                        content: `⏳ Chậm thôi! Thử lại sau **${(cd.retryIn / 1000).toFixed(1)}s**.`,
                        ephemeral: true,
                    }).catch(() => null);
                    return;
                }

                await command.execute(interaction);
                return;
            }

            if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
                const handled = await components.route(interaction);
                if (!handled && interaction.isRepliable()) {
                    await interaction.reply({
                        content: '⌛ Thành phần này đã hết hạn hoặc không còn dùng được.',
                        ephemeral: true,
                    }).catch(() => null);
                }
            }
        } catch (err) {
            logger.error('[interaction]', err);
            if (err?.code === 10062) return; // Unknown interaction
            await replyError(interaction, err.message?.slice(0, 500) || 'Có lỗi xảy ra!');
        }
    },
};
