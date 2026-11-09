const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ─── /deadline — Thêm mốc deadline cho nhóm NCKH ────────────

const DEADLINE_FILE = path.join(__dirname, '..', 'data', 'deadlines.json');

function loadDeadlines() {
    try {
        if (fs.existsSync(DEADLINE_FILE)) return JSON.parse(fs.readFileSync(DEADLINE_FILE, 'utf-8'));
    } catch (e) { console.error('[deadline.js] Lỗi đọc file:', e.message); }
    return [];
}

function saveDeadlines(data) {
    const dir = path.dirname(DEADLINE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEADLINE_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deadline')
        .setDescription('Thêm mốc deadline mới cho nhóm NCKH')
        .addStringOption(o =>
            o.setName('tieu_de').setDescription('Tiêu đề deadline').setRequired(true))
        .addStringOption(o =>
            o.setName('ngay').setDescription('Ngày hạn (DD/MM/YYYY hoặc YYYY-MM-DD)').setRequired(true))
        .addStringOption(o =>
            o.setName('mo_ta').setDescription('Mô tả ngắn (tuỳ chọn)').setRequired(false)),

    async execute(interaction) {
        try {
            const title = interaction.options.getString('tieu_de');
            const dateStr = interaction.options.getString('ngay');
            const desc = interaction.options.getString('mo_ta') || '';

            // Parse ngày: hỗ trợ DD/MM/YYYY hoặc YYYY-MM-DD
            let deadline;
            const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (ddmmyyyy) {
                deadline = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}T23:59:00+07:00`);
            } else {
                deadline = new Date(dateStr + 'T23:59:00+07:00');
            }

            if (isNaN(deadline.getTime())) {
                return interaction.reply({ content: '❌ Ngày không hợp lệ! Dùng DD/MM/YYYY hoặc YYYY-MM-DD.', ephemeral: true });
            }

            if (deadline.getTime() < Date.now()) {
                return interaction.reply({ content: '❌ Deadline phải ở tương lai!', ephemeral: true });
            }

            const deadlines = loadDeadlines();
            const newDl = {
                id: Date.now().toString(36),
                title, description: desc,
                deadline: deadline.toISOString(),
                creatorId: interaction.user.id,
                creatorTag: interaction.user.username,
                done: false,
                createdAt: new Date().toISOString(),
            };
            deadlines.push(newDl);
            saveDeadlines(deadlines);

            const ts = Math.floor(deadline.getTime() / 1000);
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📌 Deadline Mới Đã Thêm!')
                .addFields(
                    { name: '📝 Tiêu đề', value: title },
                    { name: '📅 Hạn', value: `<t:${ts}:F> (<t:${ts}:R>)` },
                    ...(desc ? [{ name: '📋 Mô tả', value: desc }] : []),
                    { name: '👤 Tạo bởi', value: interaction.user.username, inline: true },
                    { name: '🆔 ID', value: `\`${newDl.id}\``, inline: true },
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[deadline.js ERROR]', error);
            await interaction.reply({ content: '❌ Lỗi khi thêm deadline!', ephemeral: true });
        }
    },
};
