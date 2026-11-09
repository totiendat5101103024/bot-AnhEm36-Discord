const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, addBalance, subtractBalance, getOrCreateUser } = require('../utils/economy');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('xocdia')
        .setDescription('Chơi Xóc Đĩa — đặt cược Chẵn hoặc Lẻ!')
        .addStringOption(o =>
            o.setName('lua_chon').setDescription('Chẵn hoặc Lẻ').setRequired(true)
                .addChoices(
                    { name: '🔴 Chẵn (0, 2, 4 đỏ)', value: 'chan' },
                    { name: '⚪ Lẻ (1, 3 đỏ)', value: 'le' },
                ))
        .addIntegerOption(o =>
            o.setName('cuoc').setDescription('Số xu đặt cược').setRequired(true).setMinValue(50)),

    async execute(interaction) {
        try {
            const luaChon = interaction.options.getString('lua_chon');
            const cuoc = interaction.options.getInteger('cuoc');
            const check = validateBet(interaction.user.id, cuoc, interaction.user.username);
            if (!check.valid) return interaction.reply({ content: check.message, ephemeral: true });

            const loadEmbed = new EmbedBuilder().setColor(0xFFAA00).setTitle('🍽️ Xóc Đĩa')
                .setDescription(`🫙 **Đang xóc...**\n\nCược: **${cuoc.toLocaleString()} xu** → **${luaChon === 'chan' ? '🔴 Chẵn' : '⚪ Lẻ'}**`);
            await interaction.reply({ embeds: [loadEmbed] });
            await new Promise(r => setTimeout(r, 1500));

            const coins = [];
            let redCount = 0;
            for (let i = 0; i < 4; i++) {
                const isRed = Math.random() < 0.5;
                coins.push(isRed ? '🔴' : '⚪');
                if (isRed) redCount++;
            }
            const isEven = redCount % 2 === 0;
            const win = (isEven ? 'chan' : 'le') === luaChon;

            if (win) addBalance(interaction.user.id, cuoc);
            else subtractBalance(interaction.user.id, cuoc);
            const user = getOrCreateUser(interaction.user.id);

            const embed = new EmbedBuilder()
                .setColor(win ? 0x00FF88 : 0xFF4444).setTitle('🍽️ Xóc Đĩa')
                .setDescription([
                    `🍽️ ${coins.join('  ')}`,
                    `Số đỏ: **${redCount}** → **${isEven ? '🔴 Chẵn' : '⚪ Lẻ'}**`,
                    ``, win ? `🎉 Thắng! +**${cuoc.toLocaleString()} xu**` : `😢 Thua! -**${cuoc.toLocaleString()} xu**`,
                    `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                ].join('\n')).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[xocdia.js ERROR]', error);
            if (interaction.replied) await interaction.editReply({ content: '❌ Lỗi!', embeds: [] });
            else await interaction.reply({ content: '❌ Lỗi!', ephemeral: true });
        }
    },
};
