'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { prepareControl } = require('../utils/music');

const MODE_MAP = { off: 0, song: 1, queue: 2 };
const MODE_LABEL = {
    0: '⏹️ Đã **tắt** lặp lại.',
    1: '🔂 Đã bật lặp lại **1 bài hát**.',
    2: '🔁 Đã bật lặp lại **cả hàng đợi**.',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Bật/tắt lặp lại bài hát hoặc hàng đợi')
        .addStringOption((option) =>
            option
                .setName('che_do')
                .setDescription('Chọn chế độ lặp')
                .setRequired(true)
                .addChoices(
                    { name: 'Tắt', value: 'off' },
                    { name: 'Lặp 1 bài', value: 'song' },
                    { name: 'Lặp cả hàng đợi', value: 'queue' },
                )),

    async execute(interaction) {
        const queue = await prepareControl(interaction);
        if (!queue) return;

        const mode = queue.setRepeatMode(MODE_MAP[interaction.options.getString('che_do', true)]);
        await interaction.reply(MODE_LABEL[mode]);
    },
};
