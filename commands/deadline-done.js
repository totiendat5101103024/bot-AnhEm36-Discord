const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// ─── /deadline-done — Đánh dấu deadline đã hoàn thành ────────

const DEADLINE_FILE = path.join(__dirname, '..', 'data', 'deadlines.json');

function loadDeadlines() {
    try {
        if (fs.existsSync(DEADLINE_FILE)) return JSON.parse(fs.readFileSync(DEADLINE_FILE, 'utf-8'));
    } catch (e) { console.error('[deadline-done.js] Lỗi đọc file:', e.message); }
    return [];
}

function saveDeadlines(data) {
    const dir = path.dirname(DEADLINE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DEADLINE_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deadline-done')
        .setDescription('Đánh dấu deadline đã hoàn thành')
        .addStringOption(o =>
            o.setName('id').setDescription('ID của deadline (xem trong /deadline-list)').setRequired(true)),

    async execute(interaction) {
        try {
            const id = interaction.options.getString('id');
            const deadlines = loadDeadlines();
            const dl = deadlines.find(d => d.id === id);

            if (!dl) {
                return interaction.reply({ content: `❌ Không tìm thấy deadline với ID \`${id}\`!`, ephemeral: true });
            }
            if (dl.done) {
                return interaction.reply({ content: `✅ Deadline này đã được hoàn thành trước đó rồi!`, ephemeral: true });
            }

            dl.done = true;
            dl.doneBy = interaction.user.username;
            dl.doneAt = new Date().toISOString();
            saveDeadlines(deadlines);

            const embed = new EmbedBuilder()
                .setColor(0x00FF88)
                .setTitle('✅ Deadline Hoàn Thành!')
                .setDescription(`📌 **${dl.title}** đã được đánh dấu hoàn thành bởi ${interaction.user.username}!`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('[deadline-done.js ERROR]', error);
            await interaction.reply({ content: '❌ Lỗi khi cập nhật!', ephemeral: true });
        }
    },
};
