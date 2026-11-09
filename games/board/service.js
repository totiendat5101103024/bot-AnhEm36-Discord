'use strict';

/**
 * service.js — điều phối board game: tạo ván, áp nước đi, render, Elo.
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');

const store = require('./store');
const caro = require('./caro');
const chess = require('./chess');
const xiangqi = require('./xiangqi');
const { baseEmbed, COLORS, errorEmbed, truncate } = require('../../utils/ui');

const MODULES = { caro, chess, xiangqi };
const LABELS = {
    caro: 'Caro/Gomoku 15×15',
    chess: 'Cờ vua',
    xiangqi: 'Cờ tướng',
};

function getModule(type) {
    return MODULES[type] || null;
}

function userForSide(game, side) {
    return side === 'p1' ? game.player1_id : game.player2_id;
}

function nameForSide(game, side) {
    return side === 'p1' ? game.player1_name : game.player2_name;
}

function otherSide(side) {
    return side === 'p1' ? 'p2' : 'p1';
}

function sideOfPlayer(game, userId) {
    if (userId === game.player1_id) return 'p1';
    if (userId === game.player2_id) return 'p2';
    return null;
}

function playerMention(id) {
    return `<@${id}>`;
}

function buildPayload(game, stateOverride = null) {
    const mod = getModule(game.game_type);
    const state = stateOverride || game.parsed;
    if (!mod || !state) {
        return {
            embeds: [errorEmbed('Không đọc được trạng thái ván.')],
            components: [],
        };
    }

    const finished = game.status === 'finished' || !!state.result;
    const result = state.result || null;
    const status = finished
        ? `🏁 **${result?.reason || 'Ván đã kết thúc.'}**`
        : mod.renderStatus(state);

    const embed = baseEmbed({
        color: finished ? (result?.winner ? COLORS.gold : COLORS.info) : COLORS.primary,
        title: `${mod.label} — ${game.player1_name} vs ${game.player2_name}`,
        description: `${mod.renderBoard(state)}\n\n${status}`,
        footer: finished
            ? `Ván ${game.id} • Đã kết thúc`
            : `Ván ${game.id} • ${mod.sideLabel(state)}`,
    });

    if (finished && result?.elo) {
        const e = result.elo;
        embed.addFields({
            name: '🏅 Elo',
            value: [
                `${game.player1_name}: ${e.player1.delta >= 0 ? '+' : ''}${e.player1.delta} → **${e.player1.after}**`,
                `${game.player2_name}: ${e.player2.delta >= 0 ? '+' : ''}${e.player2.delta} → **${e.player2.after}**`,
            ].join('\n'),
            inline: false,
        });
    }

    const components = finished ? [] : [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`board:move:${game.id}`)
            .setLabel('Đánh')
            .setEmoji('♟️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`board:resign:${game.id}`)
            .setLabel('Xin thua')
            .setEmoji('🏳️')
            .setStyle(ButtonStyle.Danger),
    )];

    return { embeds: [embed], components };
}

function validateChallenge(interaction, type, opponent) {
    const mod = getModule(type);
    if (!mod) return { ok: false, message: 'Loại board game không hợp lệ.' };
    if (!interaction.guildId) return { ok: false, message: 'Board game chỉ dùng được trong server.' };
    if (!opponent) return { ok: false, message: 'Hãy chọn đối thủ.' };
    if (opponent.id === interaction.user.id) return { ok: false, message: 'Bạn không thể thách đấu chính mình.' };
    if (opponent.bot) return { ok: false, message: 'Không thể thách đấu bot.' };

    const mine = store.getActiveForUser(interaction.guildId, interaction.user.id);
    if (mine) return { ok: false, message: `Bạn đang có ván **${LABELS[mine.game_type] || mine.game_type}** chưa kết thúc.` };
    const theirs = store.getActiveForUser(interaction.guildId, opponent.id);
    if (theirs) return { ok: false, message: `**${opponent.username}** đang có ván khác chưa kết thúc.` };
    const inChannel = store.getActiveInChannel(interaction.guildId, interaction.channelId);
    if (inChannel) return { ok: false, message: 'Kênh này đang có một ván board game chưa kết thúc.' };

    return { ok: true, mod };
}

async function createChallenge(interaction, type, opponent) {
    const check = validateChallenge(interaction, type, opponent);
    if (!check.ok) {
        return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });
    }

    const mod = check.mod;
    const state = mod.createState();
    const game = store.createGame({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        gameType: type,
        player1: {
            id: interaction.user.id,
            name: interaction.member?.displayName || interaction.user.username,
        },
        player2: {
            id: opponent.id,
            name: opponent.username,
        },
        state,
        turn: interaction.user.id,
    });

    const payload = buildPayload(game, state);
    const msg = await interaction.reply({
        content: `${playerMention(opponent.id)} được thách đấu **${LABELS[type]}** bởi ${playerMention(interaction.user.id)}! Bấm **Đánh** khi tới lượt.`,
        ...payload,
        fetchReply: true,
    });
    store.updateGame(game.id, { state, turn: interaction.user.id, messageId: msg.id });
    return store.getGame(game.id);
}

function checkTurn(interaction, game) {
    const mod = getModule(game.game_type);
    const state = game.parsed;
    if (!mod || !state) return { ok: false, message: 'Không đọc được trạng thái ván.' };
    if (game.status !== 'active') return { ok: false, message: 'Ván này đã kết thúc.' };

    const mySide = sideOfPlayer(game, interaction.user.id);
    if (!mySide) return { ok: false, message: 'Bạn không phải người chơi trong ván này.' };
    const turnSide = mod.playerSide(state);
    if (mySide !== turnSide) return { ok: false, message: 'Chưa tới lượt bạn.' };
    return { ok: true, mod, state, side: mySide };
}

async function applyMove(interaction, game, input) {
    const turn = checkTurn(interaction, game);
    if (!turn.ok) return { ok: false, message: turn.message };

    const result = turn.mod.apply(turn.state, input, { side: turn.side });
    if (!result.ok) return { ok: false, message: result.error };

    const nextSide = turn.mod.playerSide(result.state);
    const nextTurn = userForSide(game, nextSide);

    if (result.finished) {
        const winnerId = result.winner ? userForSide(game, result.winner) : null;
        const finished = store.finishGame(game.id, {
            state: result.state,
            turn: nextTurn,
            winnerId,
        });
        if (finished?.elo) {
            result.state.result = { ...(result.state.result || {}), elo: finished.elo };
            result.elo = finished.elo;
            store.updateGame(game.id, { state: result.state, turn: nextTurn });
        }
        const updated = store.getGame(game.id);
        return { ok: true, game: updated, payload: buildPayload(updated, result.state), result };
    }

    store.updateGame(game.id, { state: result.state, turn: nextTurn });
    const updated = store.getGame(game.id);
    return { ok: true, game: updated, payload: buildPayload(updated, result.state), result };
}

async function resign(interaction, game) {
    if (game.status !== 'active') return { ok: false, message: 'Ván này đã kết thúc.' };
    const mySide = sideOfPlayer(game, interaction.user.id);
    if (!mySide) return { ok: false, message: 'Bạn không phải người chơi trong ván này.' };
    const mod = getModule(game.game_type);
    if (!mod) return { ok: false, message: 'Loại ván không hợp lệ.' };

    const result = mod.resignResult(game.parsed, mySide);
    const winnerId = result.winner ? userForSide(game, result.winner) : null;
    const finished = store.finishGame(game.id, {
        state: result.state,
        turn: game.turn,
        winnerId,
    });
    if (finished?.elo) {
        result.state.result = { ...(result.state.result || {}), elo: finished.elo };
        result.elo = finished.elo;
        store.updateGame(game.id, { state: result.state, turn: game.turn });
    }
    const updated = store.getGame(game.id);
    return { ok: true, game: updated, payload: buildPayload(updated, result.state), result };
}

async function editOriginal(interaction, game, payload) {
    // Nút/modal: cập nhật ngay message gốc nếu được.
    if (interaction.isButton?.() || interaction.isModalSubmit?.()) {
        try {
            await interaction.update(payload);
            return true;
        } catch {
            // thử cách khác bên dưới
        }
    }
    if (interaction.message?.edit) {
        try {
            await interaction.message.edit(payload);
            return true;
        } catch {
            // bỏ qua
        }
    }
    if (game?.channel_id && game?.message_id) {
        try {
            const channel = await interaction.client.channels.fetch(game.channel_id);
            const msg = await channel.messages.fetch(game.message_id);
            await msg.edit(payload);
            return true;
        } catch {
            // bỏ qua
        }
    }
    return false;
}

async function refreshMessage(interaction, game, payload) {
    const ok = await editOriginal(interaction, game, payload);
    if (!ok && interaction.isRepliable?.()) {
        await interaction.reply({ ...payload, ephemeral: false }).catch(() => null);
    }
    return ok;
}

function shortHint(type) {
    if (type === 'caro') return 'Nước đi (vd: H8)';
    if (type === 'chess') return 'Nước đi (vd: e2e4)';
    if (type === 'xiangqi') return 'Nước đi (vd: a7a4)';
    return 'Nước đi';
}

async function handleButton(interaction, action, gameId) {
    const game = store.getGame(gameId);
    if (!game) {
        return interaction.reply({
            content: '⌛ Ván này không còn tồn tại hoặc đã bị xoá.',
            ephemeral: true,
        }).catch(() => null);
    }

    if (action === 'move') {
        const turn = checkTurn(interaction, game);
        if (!turn.ok) {
            return interaction.reply({ content: turn.message, ephemeral: true });
        }
        const mod = turn.mod;
        const modal = new ModalBuilder()
            .setCustomId(`board:submit:${game.id}`)
            .setTitle(truncate(`${mod.label} — nhập nước đi`, 45))
            .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('input')
                    .setLabel(shortHint(game.game_type))
                    .setPlaceholder(truncate(mod.hint(), 100))
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(20),
            ));
        return interaction.showModal(modal);
    }

    if (action === 'resign') {
        const out = await resign(interaction, game);
        if (!out.ok) return interaction.reply({ content: out.message, ephemeral: true });
        await refreshMessage(interaction, out.game, out.payload);
        return;
    }

    if (action === 'submit') {
        const input = interaction.fields.getTextInputValue('input');
        const out = await applyMove(interaction, game, input);
        if (!out.ok) {
            return interaction.reply({ content: out.message, ephemeral: true });
        }
        await refreshMessage(interaction, out.game, out.payload);
    }
}

module.exports = {
    MODULES,
    LABELS,
    getModule,
    buildPayload,
    createChallenge,
    applyMove,
    resign,
    refreshMessage,
    handleButton,
    sideOfPlayer,
    userForSide,
    otherSide,
};
