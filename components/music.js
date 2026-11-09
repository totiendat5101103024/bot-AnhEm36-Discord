'use strict';

/**
 * components/music.js — nút điều khiển player panel.
 */

const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');
const { register } = require('../utils/components');
const { getQueue } = require('../utils/music');
const { requireSameVoice, canControl, safeReply } = require('../utils/permissions');
const { updatePlayerPanel, buildQueueEmbed } = require('../utils/player');
const { errorEmbed, successEmbed } = require('../utils/ui');
const settings = require('../utils/settings');
const logger = require('../utils/logger');

async function controlledQueue(interaction) {
    const queue = getQueue(interaction.client, interaction.guildId);
    if (!queue) {
        await safeReply(interaction, { embeds: [errorEmbed('Không có bài hát nào đang phát!')], ephemeral: true });
        return null;
    }
    if (!(await requireSameVoice(interaction, queue))) return null;
    if (!canControl(interaction.member, queue, settings.get(interaction.guildId))) {
        await safeReply(interaction, {
            embeds: [errorEmbed('Bạn cần ở cùng kênh thoại, có role DJ, hoặc là admin!')],
            ephemeral: true,
        });
        return null;
    }
    return queue;
}

register('music', async (interaction, args) => {
    const action = args[0];

    if (action === 'seekModal') {
        const queue = getQueue(interaction.client, interaction.guildId);
        if (!queue) return;
        const raw = interaction.fields.getTextInputValue('seconds');
        const seconds = Number(raw);
        if (!Number.isFinite(seconds) || seconds < 0) {
            return interaction.reply({ embeds: [errorEmbed('Số giây không hợp lệ!')], ephemeral: true });
        }
        await interaction.deferUpdate();
        try {
            await queue.seek(Math.floor(seconds));
            await updatePlayerPanel(interaction, queue);
        } catch (err) {
            logger.warn('[music:seekModal]', err.message);
            await interaction.followUp({ embeds: [errorEmbed('Không seek được bài này!')], ephemeral: true });
        }
        return;
    }

    const queue = await controlledQueue(interaction);
    if (!queue) return;

    try {
        switch (action) {
            case 'prev': {
                await interaction.deferUpdate();
                try {
                    await queue.previous();
                } catch {
                    await interaction.followUp({ embeds: [errorEmbed('Không có bài trước đó!')], ephemeral: true });
                }
                return;
            }
            case 'pause': {
                await interaction.deferUpdate();
                if (queue.paused) await queue.resume();
                else await queue.pause();
                await updatePlayerPanel(interaction, queue);
                return;
            }
            case 'skip': {
                if (queue.songs.length <= 1) {
                    await interaction.deferUpdate();
                    await queue.stop();
                    return;
                }
                await interaction.deferUpdate();
                await queue.skip();
                return;
            }
            case 'stop': {
                await interaction.deferUpdate();
                await queue.stop();
                return;
            }
            case 'loop': {
                await interaction.deferUpdate();
                queue.setRepeatMode((queue.repeatMode + 1) % 3);
                await updatePlayerPanel(interaction, queue);
                return;
            }
            case 'shuffle': {
                await interaction.deferUpdate();
                await queue.shuffle();
                await updatePlayerPanel(interaction, queue);
                return;
            }
            case 'voldown': {
                await interaction.deferUpdate();
                queue.setVolume(Math.max(0, queue.volume - 10));
                await updatePlayerPanel(interaction, queue);
                return;
            }
            case 'volup': {
                await interaction.deferUpdate();
                queue.setVolume(Math.min(100, queue.volume + 10));
                await updatePlayerPanel(interaction, queue);
                return;
            }
            case 'seek': {
                const modal = new ModalBuilder()
                    .setCustomId('music:seekModal')
                    .setTitle('Tua bài hát')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('seconds')
                                .setLabel('Tua tới giây thứ (0 - độ dài bài)')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setMaxLength(6),
                        ),
                    );
                await interaction.showModal(modal);
                return;
            }
            case 'queue': {
                await interaction.reply({
                    embeds: [buildQueueEmbed(queue, 1)],
                    ephemeral: true,
                });
                return;
            }
            default:
                await safeReply(interaction, { embeds: [errorEmbed('Nút này chưa được hỗ trợ.')], ephemeral: true });
        }
    } catch (err) {
        logger.warn('[music component]', err.message);
        try {
            await interaction.followUp({ embeds: [errorEmbed(err.message?.slice(0, 300) || 'Lỗi!')], ephemeral: true });
        } catch {
            // bỏ qua
        }
    }
});
