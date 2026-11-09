const { SlashCommandBuilder } = require('discord.js');

// DisTube v5 repeatMode: 0 = tắt, 1 = lặp 1 bài, 2 = lặp cả hàng đợi
const MODE_MAP = { off: 0, song: 1, queue: 2 };
const MODE_LABEL = {
    0: '⏹️ Đã **tắt** lặp lại.',
    1: '🔂 Đã bật lặp lại **1 bài hát**.',
    2: '🔁 Đã bật lặp lại **cả hàng đợi**.',
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Bật/tắt chế độ lặp lại bài hát hoặc hàng đợi')
        .addStringOption(option =>
            option.setName('che_do')
                .setDescription('Chọn chế độ lặp')
                .setRequired(true)
                .addChoices(
                    { name: 'Tắt', value: 'off' },
                    { name: 'Lặp 1 bài', value: 'song' },
                    { name: 'Lặp cả hàng đợi', value: 'queue' },
                )),

    async execute(interaction) {
        const queue = interaction.client.distube.getQueue(interaction.guildId);
        if (!queue) return interaction.reply({ content: '❌ Hiện tại không có bài hát nào đang phát!', ephemeral: true });

        const cheDo = interaction.options.getString('che_do');
        const newMode = queue.setRepeatMode(MODE_MAP[cheDo]);

        await interaction.reply(MODE_LABEL[newMode]);
    },
};
