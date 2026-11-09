const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { validateBet, addBalance, subtractBalance, getOrCreateUser } = require('../utils/economy');

// ─── /taixiu — Tài Xỉu (3 xúc xắc) ─────────────────────────
// Luật chuẩn: Tổng 11-17 = Tài, 4-10 = Xỉu
// Ngoại lệ: 3 xúc xắc giống nhau = BÃO (nhà cái thắng)

const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('taixiu')
        .setDescription('Chơi Tài Xỉu — đặt cược xu ảo vào Tài hoặc Xỉu')
        .addStringOption(option =>
            option.setName('lua_chon')
                .setDescription('Đặt Tài (tổng 11-17) hoặc Xỉu (tổng 4-10)')
                .setRequired(true)
                .addChoices(
                    { name: '🔴 Tài (11-17)', value: 'tai' },
                    { name: '🔵 Xỉu (4-10)', value: 'xiu' },
                ))
        .addIntegerOption(option =>
            option.setName('cuoc')
                .setDescription('Số xu muốn đặt cược')
                .setRequired(true)
                .setMinValue(50)),

    async execute(interaction) {
        try {
            const luaChon = interaction.options.getString('lua_chon');
            const cuoc = interaction.options.getInteger('cuoc');
            const check = validateBet(interaction.user.id, cuoc, interaction.user.username);
            if (!check.valid) {
                return interaction.reply({ content: check.message, ephemeral: true });
            }

            // Animation: "Đang lắc xúc xắc..."
            const loadingEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('🎲 Tài Xỉu')
                .setDescription(`🫙 **Đang lắc xúc xắc...**\n\n🎰 Cược: **${cuoc.toLocaleString()} xu** vào **${luaChon === 'tai' ? '🔴 Tài' : '🔵 Xỉu'}**`)
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

            await interaction.reply({ embeds: [loadingEmbed] });

            // Đợi 1.5 giây cho animation
            await new Promise(r => setTimeout(r, 1500));

            // Roll 3 xúc xắc
            const dice = [
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1,
            ];
            const total = dice[0] + dice[1] + dice[2];
            const diceStr = dice.map(d => DICE_EMOJI[d]).join('  ');
            const isBao = dice[0] === dice[1] && dice[1] === dice[2]; // 3 con giống nhau
            const ketQua = total >= 11 ? 'tai' : 'xiu';

            let win = false;
            let resultTitle = '';
            let resultColor = 0xFF4444;
            let balanceChange = '';

            if (isBao) {
                // BÃO: cả Tài lẫn Xỉu đều thua
                resultTitle = `🌀 BÃO! (3 con ${dice[0]}) — Nhà cái thắng!`;
                subtractBalance(interaction.user.id, cuoc);
                balanceChange = `📉 **-${cuoc.toLocaleString()} xu**`;
            } else if (ketQua === luaChon) {
                // Thắng
                win = true;
                resultTitle = `🎉 ${luaChon === 'tai' ? '🔴 TÀI' : '🔵 XỈU'} — Bạn thắng!`;
                resultColor = 0x00FF88;
                addBalance(interaction.user.id, cuoc);
                balanceChange = `📈 **+${cuoc.toLocaleString()} xu**`;
            } else {
                // Thua
                resultTitle = `😢 ${ketQua === 'tai' ? '🔴 TÀI' : '🔵 XỈU'} — Bạn thua!`;
                subtractBalance(interaction.user.id, cuoc);
                balanceChange = `📉 **-${cuoc.toLocaleString()} xu**`;
            }

            const user = getOrCreateUser(interaction.user.id);

            const resultEmbed = new EmbedBuilder()
                .setColor(resultColor)
                .setTitle('🎲 Tài Xỉu')
                .setDescription([
                    `${diceStr}`,
                    ``,
                    `Tổng: **${total}** → ${total >= 11 ? '🔴 **TÀI**' : '🔵 **XỈU**'}${isBao ? ' 🌀 **BÃO**' : ''}`,
                    ``,
                    resultTitle,
                    balanceChange,
                    ``,
                    `💵 Số dư: **${user.balance.toLocaleString()} xu**`,
                ].join('\n'))
                .setFooter({ text: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            await interaction.editReply({ embeds: [resultEmbed] });
        } catch (error) {
            console.error('[taixiu.js ERROR]', error);
            const msg = '❌ Có lỗi khi chơi Tài Xỉu!';
            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: msg, embeds: [] });
            } else {
                await interaction.reply({ content: msg, ephemeral: true });
            }
        }
    },
};
