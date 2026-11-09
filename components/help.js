'use strict';

/**
 * components/help.js — đổi nhóm lệnh trong /help.
 */

const { register } = require('../utils/components');
const { buildHelpEmbed, buildHelpSelect } = require('../utils/helpView');

register('help', async (interaction, args) => {
    if (args[0] !== 'select') return;
    const category = interaction.values?.[0] || 'all';
    await interaction.update({
        embeds: [buildHelpEmbed(interaction.client, category, interaction.user)],
        components: [buildHelpSelect(interaction.client, category)],
    }).catch(() => null);
});
