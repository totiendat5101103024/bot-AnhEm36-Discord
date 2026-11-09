const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ─── /trichdan — Citation formatter (APA + IEEE) ─────────────
// Nhận DOI hoặc Zotero item key, format ra trích dẫn chuẩn

const API_KEY = process.env.ZOTERO_API_KEY;
const LIBRARY_ID = process.env.ZOTERO_LIBRARY_ID;
const LIBRARY_TYPE = process.env.ZOTERO_LIBRARY_TYPE || 'user';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trichdan')
        .setDescription('Format trích dẫn APA/IEEE từ DOI hoặc Zotero item key')
        .addStringOption(o =>
            o.setName('input').setDescription('DOI (vd: 10.1234/abc) hoặc Zotero item key').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const input = interaction.options.getString('input').trim();
            let metadata;

            // Xác định input là DOI hay Zotero key
            if (input.startsWith('10.') || input.includes('doi.org/')) {
                // DOI → lấy metadata từ CrossRef
                const doi = input.replace(/^https?:\/\/doi\.org\//, '');
                metadata = await fetchFromDOI(doi);
            } else {
                // Zotero item key
                metadata = await fetchFromZotero(input);
            }

            if (!metadata) {
                return interaction.editReply('❌ Không tìm thấy tài liệu!');
            }

            // Format citations
            const apa = formatAPA(metadata);
            const ieee = formatIEEE(metadata);

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('📝 Trích Dẫn')
                .addFields(
                    { name: '📖 Tiêu đề', value: metadata.title || 'N/A' },
                    { name: '📋 APA', value: `\`\`\`\n${apa}\n\`\`\`` },
                    { name: '📋 IEEE', value: `\`\`\`\n${ieee}\n\`\`\`` },
                )
                .setFooter({ text: 'Copy text trong code block để dán vào bài viết' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('[trichdan.js ERROR]', error);
            await interaction.editReply(`❌ Lỗi: ${error.message}`);
        }
    },
};

// ─── Helpers ──────────────────────────────────────────────────

async function fetchFromDOI(doi) {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`CrossRef API HTTP ${res.status}`);
    const data = await res.json();
    const item = data.message;

    return {
        title: Array.isArray(item.title) ? item.title[0] : item.title,
        authors: (item.author || []).map(a => ({ first: a.given || '', last: a.family || '' })),
        year: item.published?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || '',
        journal: item['container-title']?.[0] || '',
        volume: item.volume || '',
        issue: item.issue || '',
        pages: item.page || '',
        doi: item.DOI || doi,
    };
}

async function fetchFromZotero(itemKey) {
    if (!API_KEY || !LIBRARY_ID) throw new Error('Chưa cấu hình Zotero API!');

    const url = `https://api.zotero.org/${LIBRARY_TYPE}s/${LIBRARY_ID}/items/${itemKey}`;
    const res = await fetch(url, {
        headers: { 'Zotero-API-Version': '3', 'Zotero-API-Key': API_KEY },
        signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Zotero API HTTP ${res.status}`);
    const item = await res.json();
    const d = item.data;

    return {
        title: d.title || '',
        authors: (d.creators || [])
            .filter(c => c.creatorType === 'author')
            .map(c => ({ first: c.firstName || '', last: c.lastName || c.name || '' })),
        year: d.date ? d.date.slice(0, 4) : '',
        journal: d.publicationTitle || '',
        volume: d.volume || '',
        issue: d.issue || '',
        pages: d.pages || '',
        doi: d.DOI || '',
    };
}

function formatAPA(m) {
    // APA 7th: Author, A. A., & Author, B. B. (Year). Title. Journal, Volume(Issue), Pages. DOI
    const authors = m.authors.map(a => {
        const initials = a.first ? a.first.split(' ').map(n => n[0] + '.').join(' ') : '';
        return `${a.last}, ${initials}`.trim();
    });
    let authorStr = '';
    if (authors.length === 1) authorStr = authors[0];
    else if (authors.length === 2) authorStr = `${authors[0]}, & ${authors[1]}`;
    else if (authors.length > 2) authorStr = `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;

    let citation = `${authorStr} (${m.year}). ${m.title}.`;
    if (m.journal) citation += ` ${m.journal}`;
    if (m.volume) citation += `, ${m.volume}`;
    if (m.issue) citation += `(${m.issue})`;
    if (m.pages) citation += `, ${m.pages}`;
    citation += '.';
    if (m.doi) citation += ` https://doi.org/${m.doi}`;
    return citation;
}

function formatIEEE(m) {
    // IEEE: A. A. Author and B. B. Author, "Title," Journal, vol. X, no. Y, pp. Z, Year.
    const authors = m.authors.map(a => {
        const initials = a.first ? a.first.split(' ').map(n => n[0] + '.').join(' ') : '';
        return `${initials} ${a.last}`.trim();
    });
    let authorStr = '';
    if (authors.length <= 2) authorStr = authors.join(' and ');
    else authorStr = authors.slice(0, -1).join(', ') + ', and ' + authors[authors.length - 1];

    let citation = `${authorStr}, "${m.title},"`;
    if (m.journal) citation += ` ${m.journal}`;
    if (m.volume) citation += `, vol. ${m.volume}`;
    if (m.issue) citation += `, no. ${m.issue}`;
    if (m.pages) citation += `, pp. ${m.pages}`;
    citation += `, ${m.year}.`;
    return citation;
}
