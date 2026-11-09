const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ─── /deadline-list — Xem tất cả deadline đang mở ────────────

const DEADLINE_FILE = path.join(__dirname, '..', 'data', 'deadlines.json');

function loadDeadlines() {
    try {
        if (fs.existsSync(DEADLINE_FILE)) return JSON.parse(fs.readFileSync(DEADLINE_FILE, 'utf-8'));
    } catch (e) { console.error('[deadline-list.js] Lỗi đọc file:', e.message); }
    return [];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deadline-list')
        .setDescription('Xem tất cả deadline đang mở của nhóm NCKH'),

    async execute(interaction) {
        try {
            const deadlines = loadDeadlines().filter(d => !d.done);
            if (!deadlines.length) {
                return interaction.reply({ content: '✅ Không có deadline nào đang mở! 🎉', ephemeral: true });
            }

            // Sắp xếp theo deadline gần nhất
            deadlines.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

            const lines = deadlines.map((d, i) => {
                const ts = Math.floor(new Date(d.deadline).getTime() / 1000);
                const isPast = new Date(d.deadline) < new Date();
                const status = isPast ? '🔴 QUÁ HẠN' : '';
                return `**${i + 1}.** ${d.title} ${status}\n📅 <t:${ts}:F> (<t:${ts}:R>)\n${d.description ? `📋 ${d.description}\n` : ''}🆔 \`${d.id}\` • 👤 ${d.creatorTag || 'Unknown'}`;
            });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📋 Danh Sách Deadline')
                .setDescription(lines.join('\n\n'))
                .setFooter({ text: `${deadlines.length} deadline đang mở • Dùng /deadline-done <id> để hoàn thành` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[deadline-list.js ERROR]', error);
            await interaction.reply({ content: '❌ Lỗi khi lấy danh sách!', ephemeral: true });
        }
    },
};
