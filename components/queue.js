'use strict';

/**
 * components/queue.js — phân trang hàng đợi.
 */

const { register } = require('../utils/components');
const { getQueue } = require('../utils/music');
const { buildQueueEmbed, buildQueueRows } = require('../utils/player');
const { errorEmbed } = require('../utils/ui');

register('queue', async (interaction, args) => {
    const action = args[0];

    if (action === 'close') {
        return interaction.update({ components: [] }).catch(() => null);
    }

    if (action !== 'page') return;

    const page = Number(args[1]) || 1;
    const queue = getQueue(interaction.client, interaction.guildId);
    if (!queue) {
        return interaction.update({
            embeds: [errorEmbed('Hàng đợi đã kết thúc!')],
            components: [],
        }).catch(() => null);
    }

    await interaction.update({
        embeds: [buildQueueEmbed(queue, page)],
        components: buildQueueRows(queue, page),
    }).catch(() => null);
});
