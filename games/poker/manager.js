'use strict';

/**
 * manager.js — quản lý ván Texas Hold'em nhiều người + heads-up với bot.
 *
 * Đặc điểm:
 *  - 2–6 người, blinds 10/20, 4 vòng cược, side-pot đầy đủ.
 *  - Mỗi lượt có 45 giây; hết giờ tự check nếu được, không thì fold.
 *  - Tiền mua chip bị trừ ngay và ghi vào `poker_escrow`; nếu bot restart
 *    giữa ván, `refundStaleEscrow()` hoàn lại toàn bộ tiền đang giữ.
 *  - Khi ván kết thúc, số chip còn lại được cộng lại vào số dư.
 */

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { db } = require('../../utils/db');
const economy = require('../../utils/economy');
const logger = require('../../utils/logger');
const { baseEmbed, COLORS, errorEmbed } = require('../../utils/ui');
const { freshShuffledDeck, draw, cardsStr } = require('../../utils/cards');
const { evaluate, compare, handName } = require('./evaluator');
const bot = require('./bot');

const SB = 10;
const BB = 20;
const MIN_BUY_IN = 200;
const MAX_BUY_IN = 5000;
const MAX_PLAYERS = 6;
const TURN_MS = 45_000;
const LOBBY_MS = 5 * 60_000;
const BOT_DELAY_MS = 900;

const games = new Map(); // gameId -> game
const byChannel = new Map(); // channelId -> gameId

const insertEscrow = db.prepare(
    'INSERT INTO poker_escrow (game_id, user_id, amount) VALUES (?, ?, ?)',
);
const settleEscrow = db.prepare(`
    UPDATE poker_escrow
    SET status = 'settled', amount_out = ?, updated_at = datetime('now')
    WHERE game_id = ? AND user_id = ? AND status = 'held'
`);
const refundEscrow = db.prepare(`
    UPDATE poker_escrow
    SET status = 'refunded', amount_out = amount, updated_at = datetime('now')
    WHERE game_id = ? AND user_id = ? AND status = 'held'
`);

// ─── Helpers ─────────────────────────────────────────────────
const STAGE_LABEL = {
    lobby: 'Sảnh chờ',
    preflop: 'Pre-flop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown',
};

function totalPot(game) {
    return game.players.reduce((sum, p) => sum + p.total, 0);
}

function currentPlayer(game) {
    return game.players[game.turn] || null;
}

function nextIndex(game, from, predicate) {
    const n = game.players.length;
    for (let step = 1; step <= n; step++) {
        const i = (from + step) % n;
        if (predicate(game.players[i], i)) return i;
    }
    return -1;
}

function makePlayer(user, stack, isBot = false) {
    return {
        id: user.id,
        name: user.displayName || user.username || user.name || 'Người chơi',
        isBot,
        stack,
        bet: 0,
        total: 0,
        folded: false,
        allIn: false,
        hasActed: false,
        cards: [],
        winnings: 0,
    };
}

function logAction(game, text) {
    game.log.push(text);
    if (game.log.length > 6) game.log.shift();
}

// ─── Lobby ───────────────────────────────────────────────────
async function createLobby(interaction, buyIn) {
    if (byChannel.has(interaction.channelId)) {
        return interaction.reply({
            embeds: [errorEmbed('Kênh này đang có ván poker. Hãy kết thúc ván cũ trước!')],
            ephemeral: true,
        });
    }
    if (!Number.isInteger(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
        return interaction.reply({
            embeds: [errorEmbed(`Mua chip phải từ **${MIN_BUY_IN}** đến **${MAX_BUY_IN}** xu.`)],
            ephemeral: true,
        });
    }

    const debit = economy.tryDebit(interaction.user.id, buyIn, {
        type: 'poker_buyin',
        game: 'poker',
        guildId: interaction.guildId,
    });
    if (!debit.ok) {
        return interaction.reply({ embeds: [errorEmbed(debit.message)], ephemeral: true });
    }

    const id = `p-${interaction.channelId}-${Date.now().toString(36)}`;
    const game = {
        id,
        client: interaction.client,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: null,
        hostId: interaction.user.id,
        buyIn,
        sb: SB,
        bb: BB,
        players: [makePlayer(interaction.member, buyIn)],
        deck: [],
        community: [],
        pot: 0,
        currentBet: 0,
        minRaise: BB,
        stage: 'lobby',
        turn: 0,
        dealer: 0,
        started: false,
        ended: false,
        log: [],
        resultText: '',
        timer: null,
    };

    games.set(id, game);
    byChannel.set(interaction.channelId, id);
    try {
        insertEscrow.run(id, interaction.user.id, buyIn);
    } catch (err) {
        logger.error('[poker] Không ghi được escrow:', err.message);
        economy.credit(interaction.user.id, buyIn, { type: 'poker_refund', game: 'poker' });
        games.delete(id);
        byChannel.delete(interaction.channelId);
        return interaction.reply({
            embeds: [errorEmbed('Không tạo được ván (lỗi escrow). Đã hoàn tiền.')],
            ephemeral: true,
        });
    }

    const msg = await interaction.reply({
        embeds: [renderEmbed(game)],
        components: renderComponents(game),
        fetchReply: true,
    });
    game.messageId = msg.id;

    game.lobbyTimer = setTimeout(() => expireLobby(game), LOBBY_MS);
    game.lobbyTimer.unref?.();
    return game;
}

function joinGame(game, member) {
    if (!game || game.started) return { ok: false, message: 'Ván đã bắt đầu, không thể tham gia.' };
    if (game.ended) return { ok: false, message: 'Ván đã kết thúc.' };
    if (game.players.length >= MAX_PLAYERS) {
        return { ok: false, message: `Tối đa **${MAX_PLAYERS}** người chơi.` };
    }
    if (game.players.some((p) => p.id === member.id)) {
        return { ok: false, message: 'Bạn đã tham gia ván này rồi!' };
    }

    const debit = economy.tryDebit(member.id, game.buyIn, {
        type: 'poker_buyin',
        game: 'poker',
        guildId: game.guildId,
    });
    if (!debit.ok) return { ok: false, message: debit.message };

    try {
        insertEscrow.run(game.id, member.id, game.buyIn);
    } catch (err) {
        logger.error('[poker] Không ghi được escrow khi join:', err.message);
        economy.credit(member.id, game.buyIn, { type: 'poker_refund', game: 'poker' });
        return { ok: false, message: 'Không thể vào ván (lỗi escrow). Đã hoàn tiền.' };
    }
    game.players.push(makePlayer(member, game.buyIn));
    logAction(game, `➕ ${member.displayName || member.user.username} tham gia.`);
    return { ok: true };
}

function refundLobby(game) {
    for (const p of game.players) {
        if (p.isBot) continue;
        economy.credit(p.id, game.buyIn, {
            type: 'poker_refund',
            game: 'poker',
            guildId: game.guildId,
        });
        refundEscrow.run(game.id, p.id);
    }
    clearTimeout(game.lobbyTimer);
    games.delete(game.id);
    byChannel.delete(game.channelId);
}

async function expireLobby(game) {
    if (game.started || game.ended) return;
    const names = game.players.map((p) => p.name).join(', ');
    refundLobby(game);
    try {
        const channel = await game.client.channels.fetch(game.channelId);
        const msg = await channel.messages.fetch(game.messageId);
        await msg.edit({
            embeds: [baseEmbed({
                color: COLORS.dark,
                title: '⌛ Sảnh chờ hết hạn',
                description: `Sảnh chờ quá 5 phút không bắt đầu. Đã hoàn tiền mua chip cho: ${names}.`,
            })],
            components: [],
        });
    } catch (err) {
        logger.debug('[poker expire]', err.message);
    }
}

// ─── Bắt đầu ván ─────────────────────────────────────────────
function postBlind(game, player, amount) {
    const pay = Math.min(amount, player.stack);
    player.stack -= pay;
    player.bet += pay;
    player.total += pay;
    if (player.stack === 0) player.allIn = true;
    return pay;
}

function startGame(game, actorId = null) {
    if (!game || game.ended) return { ok: false, message: 'Ván đã kết thúc.' };
    if (game.started) return { ok: false, message: 'Ván đang diễn ra.' };
    if (actorId && actorId !== game.hostId) {
        return { ok: false, message: 'Chỉ người tạo ván mới được bắt đầu!' };
    }
    if (game.players.length < 2) {
        return { ok: false, message: 'Cần ít nhất **2 người** để bắt đầu.' };
    }

    clearTimeout(game.lobbyTimer);
    game.started = true;
    game.stage = 'preflop';
    game.deck = freshShuffledDeck();
    game.community = [];
    game.pot = 0;
    game.log = [];
    game.dealer = Math.floor(Math.random() * game.players.length);

    for (const p of game.players) {
        p.cards = draw(game.deck, 2);
        p.bet = 0;
        p.total = 0;
        p.folded = false;
        p.allIn = false;
        p.hasActed = false;
        p.winnings = 0;
    }

    const n = game.players.length;
    const sbIdx = n === 2 ? game.dealer : (game.dealer + 1) % n;
    const bbIdx = n === 2 ? (game.dealer + 1) % n : (game.dealer + 2) % n;

    const sbPaid = postBlind(game, game.players[sbIdx], SB);
    const bbPaid = postBlind(game, game.players[bbIdx], BB);
    logAction(game, `🎲 Dealer: **${game.players[game.dealer].name}** • SB ${sbPaid}, BB ${bbPaid}`);

    game.currentBet = BB;
    game.minRaise = BB;
    game.turn = nextIndex(game, bbIdx, (p) => !p.allIn);
    if (game.turn === -1) game.turn = bbIdx;

    return { ok: true };
}

async function beginGame(interaction, game) {
    const result = startGame(game);
    if (!result.ok) return result;

    await sync(game);
    await sendHoleCards(game);
    schedule(game);
    return result;
}

// ─── Vòng cược ───────────────────────────────────────────────
function resetOthers(game, actor) {
    for (const p of game.players) {
        if (p === actor || p.folded || p.allIn) continue;
        p.hasActed = false;
    }
}

function roundComplete(game) {
    const active = game.players.filter((p) => !p.folded && !p.allIn);
    if (active.length === 0) return true;
    return active.every((p) => p.hasActed && p.bet === game.currentBet);
}

function collectBets(game) {
    const sum = game.players.reduce((s, p) => s + p.bet, 0);
    game.pot += sum;
    for (const p of game.players) {
        p.bet = 0;
        p.hasActed = false;
    }
    game.currentBet = 0;
    game.minRaise = game.bb;
}

function firstAfterDealer(game) {
    return nextIndex(game, game.dealer, (p) => !p.folded && !p.allIn);
}

function advanceStage(game) {
    collectBets(game);

    if (game.stage === 'preflop') {
        game.stage = 'flop';
        game.community.push(...draw(game.deck, 3));
    } else if (game.stage === 'flop') {
        game.stage = 'turn';
        game.community.push(draw(game.deck, 1));
    } else if (game.stage === 'turn') {
        game.stage = 'river';
        game.community.push(draw(game.deck, 1));
    } else {
        finishHand(game, 'showdown');
        return;
    }

    if (game.players.filter((p) => !p.folded).length === 1) {
        finishHand(game, 'fold');
        return;
    }

    const canAct = game.players.filter((p) => !p.folded && !p.allIn);
    if (canAct.length <= 1) {
        runOutBoard(game);
        finishHand(game, 'showdown');
        return;
    }

    game.turn = firstAfterDealer(game);
    if (game.turn === -1) game.turn = 0;
}

function runOutBoard(game) {
    while (game.community.length < 5) {
        game.community.push(draw(game.deck, 1));
    }
}

// ─── Chia tiền ───────────────────────────────────────────────
function computePayouts(game) {
    const payouts = new Map(game.players.map((p) => [p.id, 0]));
    const contenders = game.players.filter((p) => !p.folded);

    if (contenders.length === 1) {
        payouts.set(contenders[0].id, totalPot(game));
        return payouts;
    }

    const levels = [...new Set(game.players.map((p) => p.total).filter((v) => v > 0))]
        .sort((a, b) => a - b);

    let prev = 0;
    for (const level of levels) {
        let amount = 0;
        const eligible = [];
        for (const p of game.players) {
            const contribution = Math.min(p.total, level) - Math.min(p.total, prev);
            if (contribution > 0) amount += contribution;
            if (p.total >= level && !p.folded) eligible.push(p);
        }

        if (amount > 0) {
            if (eligible.length === 0) {
                // Tiền thừa không ai tranh được → trả lại người góp nhiều nhất.
                const owner = [...game.players]
                    .filter((p) => p.total >= level)
                    .sort((a, b) => b.total - a.total)[0];
                if (owner) payouts.set(owner.id, payouts.get(owner.id) + amount);
            } else {
                const ranked = eligible
                    .map((p) => ({ p, hand: evaluate([...p.cards, ...game.community]) }))
                    .sort((a, b) => compare(b.hand, a.hand));
                const best = ranked[0].hand;
                const winners = ranked.filter((x) => compare(x.hand, best) === 0);
                const share = Math.floor(amount / winners.length);
                let rem = amount - share * winners.length;
                for (const w of winners) {
                    payouts.set(w.p.id, payouts.get(w.p.id) + share + (rem > 0 ? 1 : 0));
                    if (rem > 0) rem--;
                }
            }
        }
        prev = level;
    }
    return payouts;
}

function settleGame(game) {
    const diff = (p) => p.stack - game.buyIn;
    for (const p of game.players) {
        if (p.isBot) continue;

        if (p.stack > 0) {
            economy.credit(p.id, p.stack, {
                type: 'poker_cashout',
                game: 'poker',
                guildId: game.guildId,
            });
        }
        settleEscrow.run(p.stack, game.id, p.id);

        const delta = diff(p);
        economy.recordGame(
            p.id,
            game.guildId,
            'poker',
            delta > 0 ? 'win' : delta < 0 ? 'loss' : 'draw',
            Math.abs(delta),
        );
    }
}

function finishHand(game, reason) {
    if (game.ended) return;
    game.ended = true;
    game.stage = 'showdown';
    clearTimeout(game.timer);
    clearTimeout(game.lobbyTimer);

    if (reason === 'showdown') runOutBoard(game);

    const contenders = game.players.filter((p) => !p.folded);
    if (contenders.length > 1) runOutBoard(game);

    const payouts = computePayouts(game);
    for (const p of game.players) {
        p.winnings = payouts.get(p.id) || 0;
        p.stack += p.winnings;
    }

    if (reason === 'fold' && contenders.length === 1) {
        game.resultText = `🏆 **${contenders[0].name}** thắng **${totalPot(game).toLocaleString()} xu** vì mọi người bỏ bài.`;
    } else {
        const lines = contenders.map((p) => {
            const hand = handName(evaluate([...p.cards, ...game.community]));
            return `**${p.name}**: ${cardsStr(p.cards)} — ${hand}`;
        });
        const winners = game.players
            .filter((p) => p.winnings > 0)
            .map((p) => `🏆 **${p.name}** +${p.winnings.toLocaleString()} xu`);
        game.resultText = `${lines.join('\n')}\n\n${winners.join('\n') || 'Không có người thắng.'}`;
    }

    settleGame(game);
    byChannel.delete(game.channelId);

    sync(game).then(() => sendHoleCards(game, true));

    // Giữ object thêm 2 phút để nút bấm trả lời "đã kết thúc", rồi dọn.
    const cleanup = setTimeout(() => games.delete(game.id), 120_000);
    cleanup.unref?.();
}

// ─── Hành động ───────────────────────────────────────────────
async function act(game, playerId, action) {
    if (!game.started || game.ended) return { ok: false, message: 'Ván đã kết thúc.' };

    const p = currentPlayer(game);
    if (!p || p.id !== playerId) return { ok: false, message: 'Chưa tới lượt bạn.' };
    if (p.folded || p.allIn) return { ok: false, message: 'Bạn không thể hành động lúc này.' };

    const toCall = Math.max(0, game.currentBet - p.bet);

    switch (action.type) {
        case 'fold':
            p.folded = true;
            p.hasActed = true;
            logAction(game, `🚪 ${p.name} bỏ bài.`);
            break;

        case 'check':
            if (toCall > 0) {
                return { ok: false, message: `Bạn phải theo **${toCall} xu** hoặc bỏ bài.` };
            }
            p.hasActed = true;
            logAction(game, `✅ ${p.name} check.`);
            break;

        case 'call': {
            const pay = Math.min(toCall, p.stack);
            p.stack -= pay;
            p.bet += pay;
            p.total += pay;
            if (p.stack === 0) p.allIn = true;
            p.hasActed = true;
            logAction(game, pay > 0 ? `💰 ${p.name} theo **${pay}**.` : `✅ ${p.name} check.`);
            break;
        }

        case 'allin': {
            const pay = p.stack;
            p.stack = 0;
            p.bet += pay;
            p.total += pay;
            p.allIn = true;
            p.hasActed = true;
            if (p.bet > game.currentBet) {
                game.minRaise = Math.max(game.minRaise, p.bet - game.currentBet);
                game.currentBet = p.bet;
                resetOthers(game, p);
            }
            logAction(game, `🔥 ${p.name} all-in **${pay}**.`);
            break;
        }

        case 'raise': {
            const target = Math.floor(Number(action.amount) || 0);
            const maxTo = p.bet + p.stack;
            if (target <= game.currentBet) {
                return { ok: false, message: `Phải raise cao hơn **${game.currentBet}**.` };
            }
            if (target > maxTo) {
                return { ok: false, message: `Bạn chỉ có thể raise tối đa **${maxTo}**.` };
            }
            const minTo = game.currentBet + game.minRaise;
            if (target < minTo && target < maxTo) {
                return { ok: false, message: `Raise tối thiểu tới **${minTo}**.` };
            }
            const pay = target - p.bet;
            p.stack -= pay;
            p.bet = target;
            p.total += pay;
            if (p.stack === 0) p.allIn = true;
            game.minRaise = Math.max(game.minRaise, target - game.currentBet);
            game.currentBet = target;
            resetOthers(game, p);
            p.hasActed = true;
            logAction(game, `📈 ${p.name} raise tới **${target}**.`);
            break;
        }

        case 'timeout': {
            if (toCall > 0) {
                p.folded = true;
                logAction(game, `⌛ ${p.name} hết giờ → bỏ bài.`);
            } else {
                p.hasActed = true;
                logAction(game, `⌛ ${p.name} hết giờ → check.`);
            }
            break;
        }

        default:
            return { ok: false, message: 'Hành động không hợp lệ.' };
    }

    const contenders = game.players.filter((x) => !x.folded);
    if (contenders.length === 1) {
        finishHand(game, 'fold');
        return { ok: true };
    }

    if (roundComplete(game)) {
        advanceStage(game);
    } else {
        game.turn = nextIndex(game, game.turn, (x) => !x.folded && !x.allIn);
        if (game.turn === -1) {
            runOutBoard(game);
            finishHand(game, 'showdown');
            return { ok: true };
        }
    }

    if (game.ended) return { ok: true };

    await sync(game);
    schedule(game);
    return { ok: true };
}

function schedule(game) {
    clearTimeout(game.timer);
    if (!game.started || game.ended) return;

    const p = currentPlayer(game);
    if (!p || p.folded || p.allIn) return;

    if (p.isBot) {
        game.timer = setTimeout(() => {
            const decision = bot.decide(game, p);
            act(game, p.id, decision).catch((err) => logger.error('[poker bot]', err));
        }, BOT_DELAY_MS);
    } else {
        game.timer = setTimeout(() => {
            act(game, p.id, { type: 'timeout' }).catch((err) => logger.error('[poker timeout]', err));
        }, TURN_MS);
    }
    game.timer.unref?.();
}

// ─── Hiển thị ────────────────────────────────────────────────
function renderEmbed(game) {
    const lines = game.players.map((p, i) => {
        const isTurn = game.started && !game.ended && i === game.turn;
        let cards = '';
        if (game.ended) {
            cards = p.folded ? ' *(bỏ bài)*' : ` | ${cardsStr(p.cards)}`;
        } else if (game.started && p.cards.length) {
            cards = ' | 🂠 🂠';
        }
        const status = p.folded ? ' — *đã bỏ*' : p.allIn ? ' — *all-in*' : '';
        return `${isTurn ? '▶️ ' : ''}**${p.name}**${p.isBot ? ' 🤖' : ''}: `
            + `**${p.stack.toLocaleString()}** xu • cược ${p.bet.toLocaleString()}${status}${cards}`;
    }).join('\n');

    const board = game.community.length
        ? `${cardsStr(game.community)} ${'🂠 '.repeat(5 - game.community.length)}`.trim()
        : '🂠 🂠 🂠 🂠 🂠';

    const embed = baseEmbed({
        color: game.ended ? COLORS.gold : COLORS.primary,
        title: game.started
            ? `🃏 Texas Hold'em — ${STAGE_LABEL[game.stage] || game.stage}`
            : `🃏 Texas Hold'em — ${STAGE_LABEL.lobby}`,
        description: game.started
            ? `${board}\n\n**Pot: ${totalPot(game).toLocaleString()} xu**\n\n${lines}`
            : `Mua chip: **${game.buyIn.toLocaleString()} xu** • Blinds ${SB}/${BB}\n`
                + `Người chơi **${game.players.length}/${MAX_PLAYERS}**\n\n${lines}`,
        footer: game.started
            ? `Dealer: ${game.players[game.dealer]?.name || '?'} • ${game.ended ? 'Ván đã kết thúc' : `Lượt của ${currentPlayer(game)?.name || '?'}`}`
            : 'Bấm Tham gia để vào ván • chủ ván bấm Bắt đầu',
    });

    if (game.started) {
        embed.addFields({ name: '📝 Diễn biến', value: game.log.join('\n') || '—' });
    }
    if (game.ended && game.resultText) {
        embed.addFields({ name: '🏁 Kết quả', value: game.resultText.slice(0, 1024) });
    }
    return embed;
}

function renderComponents(game) {
    const id = game.id;
    if (!game.started) {
        return [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`poker:join:${id}`).setLabel('Tham gia').setEmoji('➕').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`poker:start:${id}`).setLabel('Bắt đầu').setEmoji('▶️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`poker:cancel:${id}`).setLabel('Huỷ').setEmoji('✖️').setStyle(ButtonStyle.Danger),
        )];
    }

    const p = currentPlayer(game);
    const toCall = p ? Math.max(0, game.currentBet - p.bet) : 0;
    const callLabel = toCall > 0 ? `Theo ${toCall}` : 'Check';

    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`poker:fold:${id}`).setLabel('Bỏ bài').setEmoji('🚪').setStyle(ButtonStyle.Danger).setDisabled(game.ended),
        new ButtonBuilder().setCustomId(`poker:call:${id}`).setLabel(callLabel).setEmoji('✅').setStyle(ButtonStyle.Primary).setDisabled(game.ended),
        new ButtonBuilder().setCustomId(`poker:raise:${id}`).setLabel('Raise').setEmoji('📈').setStyle(ButtonStyle.Secondary).setDisabled(game.ended),
        new ButtonBuilder().setCustomId(`poker:allin:${id}`).setLabel('All-in').setEmoji('🔥').setStyle(ButtonStyle.Secondary).setDisabled(game.ended),
    )];
}

async function sync(game, note = null) {
    if (!game.messageId) return;
    try {
        const channel = await game.client.channels.fetch(game.channelId);
        const msg = await channel.messages.fetch(game.messageId);
        const payload = {
            embeds: [renderEmbed(game)],
            components: renderComponents(game),
        };
        if (note) payload.content = note;
        await msg.edit(payload);
    } catch (err) {
        logger.debug('[poker sync]', err.message);
    }
}

async function sendHoleCards(game, reveal = false) {
    for (const p of game.players) {
        if (p.isBot) continue;
        try {
            const user = await game.client.users.fetch(p.id);
            if (!user) continue;
            if (reveal || game.ended) {
                const text = p.folded
                    ? `🃏 Ván kết thúc. Bài của bạn: **${cardsStr(p.cards)}** (đã bỏ).`
                    : `🃏 Ván kết thúc. Bài của bạn: **${cardsStr(p.cards)}** • Board: ${cardsStr(game.community)}`;
                await user.send(text).catch(() => null);
            } else {
                await user.send(`🃏 Bài của bạn: **${cardsStr(p.cards)}**`).catch(() => null);
            }
        } catch {
            // người dùng chặn DM — bỏ qua
        }
    }
}

// ─── Nút bấm ─────────────────────────────────────────────────
async function handleButton(interaction, action, gameId) {
    const game = games.get(gameId);
    if (!game) {
        return interaction.reply({
            content: '⌛ Ván này đã kết thúc hoặc không còn tồn tại.',
            ephemeral: true,
        }).catch(() => null);
    }

    if (action === 'join') {
        if (game.started || game.ended) {
            return interaction.reply({ content: 'Ván đã bắt đầu, không thể tham gia.', ephemeral: true });
        }
        await interaction.deferUpdate().catch(() => null);
        const result = joinGame(game, interaction.member);
        if (!result.ok) {
            return interaction.followUp({ content: result.message, ephemeral: true }).catch(() => null);
        }
        await sync(game);
        return;
    }

    if (action === 'start') {
        if (game.started || game.ended) {
            return interaction.reply({ content: 'Ván đã bắt đầu rồi!', ephemeral: true });
        }
        if (interaction.user.id !== game.hostId) {
            return interaction.reply({ content: 'Chỉ chủ ván mới được bắt đầu!', ephemeral: true });
        }
        await interaction.deferUpdate().catch(() => null);
        const result = await beginGame(interaction, game);
        if (!result.ok) {
            return interaction.followUp({ content: result.message, ephemeral: true }).catch(() => null);
        }
        return;
    }

    if (action === 'cancel') {
        if (interaction.user.id !== game.hostId) {
            return interaction.reply({ content: 'Chỉ chủ ván mới được huỷ.', ephemeral: true });
        }
        if (game.started) {
            return interaction.reply({ content: 'Ván đã bắt đầu, không thể huỷ — hãy bỏ bài nếu muốn dừng.', ephemeral: true });
        }
        const players = game.players.map((p) => p.name).join(', ');
        refundLobby(game);
        await interaction.update({
            embeds: [baseEmbed({
                color: COLORS.dark,
                title: '🃏 Ván poker đã huỷ',
                description: `Đã hoàn tiền mua chip cho: ${players}.`,
            })],
            components: [],
        }).catch(() => null);
        return;
    }

    if (action === 'raiseModal') {
        if (!game.started || game.ended) {
            return interaction.reply({ content: 'Ván đã kết thúc.', ephemeral: true });
        }
        const p = currentPlayer(game);
        if (!p || p.id !== interaction.user.id) {
            return interaction.reply({ content: 'Chưa tới lượt bạn.', ephemeral: true });
        }
        const amount = Number(interaction.fields.getTextInputValue('amount'));
        await interaction.deferUpdate().catch(() => null);
        const result = await act(game, p.id, { type: 'raise', amount });
        if (!result.ok) {
            return interaction.followUp({ content: result.message, ephemeral: true }).catch(() => null);
        }
        return;
    }

    if (!game.started || game.ended) {
        return interaction.reply({ content: 'Ván chưa bắt đầu hoặc đã kết thúc.', ephemeral: true });
    }

    const p = currentPlayer(game);
    if (!p || p.id !== interaction.user.id) {
        return interaction.reply({ content: 'Chưa tới lượt bạn!', ephemeral: true });
    }

    if (action === 'raise') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
        const maxTo = p.bet + p.stack;
        const minTo = Math.min(maxTo, game.currentBet + game.minRaise);
        const modal = new ModalBuilder()
            .setCustomId(`poker:raiseModal:${game.id}`)
            .setTitle('Raise')
            .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('amount')
                    .setLabel(`Raise TỚI (min ${minTo}, max ${maxTo})`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(String(minTo)),
            ));
        return interaction.showModal(modal);
    }

    await interaction.deferUpdate().catch(() => null);
    const result = await act(game, p.id, { type: action });
    if (!result.ok) {
        return interaction.followUp({ content: result.message, ephemeral: true }).catch(() => null);
    }
}

// ─── Heads-up với bot ────────────────────────────────────────
async function createBotGame(interaction, buyIn) {
    if (byChannel.has(interaction.channelId)) {
        return interaction.reply({
            embeds: [errorEmbed('Kênh này đang có ván poker. Hãy kết thúc ván cũ trước!')],
            ephemeral: true,
        });
    }
    if (!Number.isInteger(buyIn) || buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN) {
        return interaction.reply({
            embeds: [errorEmbed(`Mua chip phải từ **${MIN_BUY_IN}** đến **${MAX_BUY_IN}** xu.`)],
            ephemeral: true,
        });
    }

    const debit = economy.tryDebit(interaction.user.id, buyIn, {
        type: 'poker_buyin',
        game: 'poker',
        guildId: interaction.guildId,
    });
    if (!debit.ok) {
        return interaction.reply({ embeds: [errorEmbed(debit.message)], ephemeral: true });
    }

    const id = `pb-${interaction.channelId}-${Date.now().toString(36)}`;
    const game = {
        id,
        client: interaction.client,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageId: null,
        hostId: interaction.user.id,
        buyIn,
        sb: SB,
        bb: BB,
        players: [
            makePlayer(interaction.member, buyIn),
            makePlayer({ id: 'bot', displayName: 'Bot Sinh Tồn', username: 'Bot' }, buyIn, true),
        ],
        deck: [],
        community: [],
        pot: 0,
        currentBet: 0,
        minRaise: BB,
        stage: 'lobby',
        turn: 0,
        dealer: 0,
        started: false,
        ended: false,
        log: [],
        resultText: '',
        timer: null,
    };

    games.set(id, game);
    byChannel.set(interaction.channelId, id);
    try {
        insertEscrow.run(id, interaction.user.id, buyIn);
    } catch (err) {
        logger.error('[pokerbot] Không ghi được escrow:', err.message);
        economy.credit(interaction.user.id, buyIn, { type: 'poker_refund', game: 'poker' });
        games.delete(id);
        byChannel.delete(interaction.channelId);
        return interaction.reply({
            embeds: [errorEmbed('Không tạo được ván (lỗi escrow). Đã hoàn tiền.')],
            ephemeral: true,
        });
    }

    const msg = await interaction.reply({
        embeds: [baseEmbed({
            color: COLORS.primary,
            title: '🤖 Heads-up với Bot',
            description: `Bạn vs **Bot Sinh Tồn** • mua chip **${buyIn.toLocaleString()} xu**\nĐang chia bài...`,
        })],
        components: [],
        fetchReply: true,
    });
    game.messageId = msg.id;

    startGame(game);
    await sync(game);
    await sendHoleCards(game);
    schedule(game);

    return game;
}

// ─── Hoàn tiền khi restart ───────────────────────────────────
function refundStaleEscrow() {
    const rows = db.prepare("SELECT * FROM poker_escrow WHERE status = 'held'").all();
    for (const row of rows) {
        economy.credit(row.user_id, row.amount, {
            type: 'poker_refund',
            game: 'poker',
        });
        db.prepare(`
            UPDATE poker_escrow
            SET status = 'refunded', amount_out = amount, updated_at = datetime('now')
            WHERE id = ?
        `).run(row.id);
    }
    if (rows.length) {
        logger.info(`[poker] Hoàn tiền ${rows.length} khoản escrow còn treo sau restart.`);
    }
    return rows.length;
}

module.exports = {
    createLobby,
    createBotGame,
    joinGame,
    startGame,
    act,
    handleButton,
    refundStaleEscrow,
    renderEmbed,
    games,
    SB,
    BB,
    MIN_BUY_IN,
    MAX_BUY_IN,
};
