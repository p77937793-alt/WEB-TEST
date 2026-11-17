/**
 * games.js — 互動小遊戲引擎
 * ------------------------------------------------------------
 * 三種遊戲「類型」(type) 各有一個引擎；遊戲的標題、規則、難度、
 * 計分、題庫全部來自 data.json 的 games 陣列，後台改了這裡就跟著變。
 *
 * 引擎介面：engine(area, game, diff, done) → 回傳清理函式（停止計時器）
 *   done({ score, title, detail }) 代表一局結束。
 */
import { h, shuffle } from '../core/utils.js';

export const GAME_TYPES = {
  quiz: { label: '知識問答', icon: '🧠' },
  memory: { label: '記憶翻牌', icon: '🃏' },
  dice: { label: '骰運挑戰', icon: '🎯' },
};

const num = (v, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : fallback);

/* ---------- 最高分（存在訪客自己的瀏覽器） ---------- */
const bestKey = (game, diff) => `bgsite:best:${game.id}:${diff?.id || 'default'}`;
export function getBest(game, diff) {
  try { return Number(localStorage.getItem(bestKey(game, diff))) || 0; } catch { return 0; }
}
function setBest(game, diff, score) {
  try { localStorage.setItem(bestKey(game, diff), String(score)); } catch { /* 無痕模式可能無法寫入，忽略 */ }
}

/**
 * 把一個遊戲掛到 stage 元素上：說明畫面 → 遊玩 → 結算。
 * 回傳 dispose()，關閉視窗時呼叫以停止所有計時器。
 */
export function mountGame(stage, game) {
  let dispose = () => {};
  const diffs = game.difficulties?.length ? game.difficulties : [{ id: 'default', label: '標準' }];
  let diff = diffs[0];
  const meta = GAME_TYPES[game.type] || { label: game.type, icon: '🎮' };

  function intro() {
    dispose(); dispose = () => {};
    const bestEl = h('p', { class: 'g-best' });
    const updateBest = () => { bestEl.textContent = `此難度最高分：${getBest(game, diff)}`; };
    const diffBtns = diffs.map((d) => h('button', {
      class: 'chip' + (d === diff ? ' active' : ''), type: 'button',
      onclick: (e) => {
        diff = d;
        diffBtns.forEach((b) => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        updateBest();
      },
    }, d.label));
    updateBest();
    stage.replaceChildren(
      h('div', { class: 'g-intro' },
        h('div', { class: 'g-icon' }, game.icon || meta.icon),
        h('span', { class: 'badge' }, meta.label),
        h('h2', {}, game.title),
        game.summary && h('p', { class: 'muted' }, game.summary),
        game.rules?.length ? h('div', { class: 'g-rules' }, h('h4', {}, '遊戲規則'), h('ol', {}, game.rules.map((r) => h('li', {}, r)))) : null,
        h('h4', {}, '選擇難度'),
        h('div', { class: 'chips' }, diffBtns),
        bestEl,
        h('button', { class: 'btn primary lg', onclick: play }, '開始遊戲')));
  }

  function play() {
    const area = h('div', { class: 'g-play' });
    stage.replaceChildren(area);
    const engine = ENGINES[game.type];
    if (!engine) { area.append(h('p', {}, `尚未支援的遊戲類型：${game.type}`)); return; }
    dispose = engine(area, game, diff, result) || (() => {});
  }

  function result({ score, title, detail }) {
    dispose(); dispose = () => {};
    const prev = getBest(game, diff);
    const isBest = score > prev;
    if (isBest) setBest(game, diff, score);
    stage.replaceChildren(
      h('div', { class: 'g-result' },
        h('div', { class: 'g-icon' }, isBest ? '🏆' : '🎉'),
        h('h2', {}, title || '挑戰結束'),
        h('div', { class: 'g-score' }, String(score)),
        h('p', { class: 'muted' }, detail || ''),
        h('p', { class: 'g-best' }, isBest ? '刷新此難度的最高分！' : `此難度最高分：${prev}`),
        h('div', { class: 'row center' },
          h('button', { class: 'btn primary', onclick: play }, '再玩一次'),
          h('button', { class: 'btn ghost', onclick: intro }, '換個難度'))));
  }

  intro();
  return () => dispose();
}

/** 遊戲中的頂部資訊列 */
function hud(items) {
  const cells = items.map(([label]) => h('div', {}, h('small', {}, label), h('b', {}, '')));
  const el = h('div', { class: 'g-hud' }, cells);
  el.set = (i, v) => { cells[i].lastChild.textContent = String(v); };
  items.forEach(([, v], i) => el.set(i, v));
  return el;
}

const ENGINES = {
  /* ============ 知識問答 ============ */
  quiz(area, game, diff, done) {
    const sc = game.scoring || {};
    const pool = shuffle((game.questions || []).filter((q) => q.q && q.options?.length >= 2))
      .slice(0, Math.max(1, num(diff.questionCount, 5)));
    if (!pool.length) { area.append(h('p', { class: 'muted' }, '題庫目前是空的，請到後台新增題目。')); return; }

    let index = 0, score = 0, correct = 0, timer = null;
    const total = Math.max(3, num(diff.timePerQuestion, 15));

    function show() {
      const q = pool[index];
      let left = total, locked = false;
      const top = hud([['題目', `${index + 1} / ${pool.length}`], ['分數', score]]);
      const bar = h('div', { class: 'g-bar' }, h('i'));
      const fb = h('div', { class: 'g-fb' });
      const opts = q.options.map((text, i) => h('button', { class: 'g-opt', type: 'button', onclick: () => pick(i) },
        h('b', {}, 'ABCDEF'[i] || '•'), h('span', {}, text)));
      area.replaceChildren(top, bar, h('h3', { class: 'g-q' }, q.q), h('div', { class: 'g-opts' }, opts), fb);

      const t0 = performance.now();
      timer = setInterval(() => {
        left = total - (performance.now() - t0) / 1000;
        bar.firstChild.style.width = `${Math.max(0, (left / total) * 100)}%`;
        if (left <= 0) pick(-1); // 超時
      }, 100);

      function pick(i) {
        if (locked) return;
        locked = true;
        clearInterval(timer);
        const ok = i === Number(q.answer);
        if (ok) {
          correct++;
          score += num(sc.correct, 100) + Math.floor(Math.max(0, left)) * num(sc.timeBonus, 0);
        } else {
          score = Math.max(0, score - num(sc.wrongPenalty, 0));
        }
        top.set(1, score);
        opts.forEach((b, k) => {
          b.disabled = true;
          if (k === Number(q.answer)) b.classList.add('ok');
          else if (k === i) b.classList.add('no');
        });
        const last = index + 1 >= pool.length;
        fb.replaceChildren(
          h('p', {}, (ok ? '✅ 答對了！' : i < 0 ? '⏰ 時間到！' : '❌ 答錯了。') + (q.explain ? ` ${q.explain}` : '')),
          h('button', { class: 'btn primary', onclick: () => {
            index++;
            if (last) done({ score, title: '問答結束', detail: `答對 ${correct} / ${pool.length} 題` });
            else show();
          } }, last ? '看結果' : '下一題'));
        fb.lastChild.focus();
      }
    }
    show();
    return () => clearInterval(timer);
  },

  /* ============ 記憶翻牌 ============ */
  memory(area, game, diff, done) {
    const sc = game.scoring || {};
    const symbols = [...new Set(game.symbols || [])];
    const pairs = Math.min(Math.max(2, num(diff.pairs, 6)), symbols.length);
    if (symbols.length < 2) { area.append(h('p', { class: 'muted' }, '圖案不足，請到後台至少設定 2 個翻牌圖案。')); return; }

    const deck = shuffle(shuffle(symbols).slice(0, pairs).flatMap((x) => [x, x]));
    const total = Math.max(10, num(diff.timeLimit, 60));
    let score = 0, matched = 0, moves = 0, open = [], busy = false, left = total, flipT = null, ended = false;

    const top = hud([['剩餘時間', `${total}s`], ['配對', `0 / ${pairs}`], ['分數', 0]]);
    const grid = h('div', { class: 'm-grid', style: { '--cols': Math.ceil(Math.sqrt(deck.length)) } },
      deck.map((sym) => {
        const card = h('button', { class: 'm-card', type: 'button', 'aria-label': '未翻開的卡牌' },
          h('span', { class: 'm-in' }, h('span', { class: 'm-front' }, '✦'), h('span', { class: 'm-back' }, sym)));
        card.addEventListener('click', () => flip(card, sym));
        return card;
      }));
    area.replaceChildren(top, grid);

    const t0 = performance.now();
    const timer = setInterval(() => {
      left = total - (performance.now() - t0) / 1000;
      top.set(0, `${Math.max(0, Math.ceil(left))}s`);
      if (left <= 0) finish(false);
    }, 200);

    function flip(card, sym) {
      if (busy || ended || card.classList.contains('on')) return;
      card.classList.add('on');
      card.setAttribute('aria-label', `卡牌 ${sym}`);
      open.push({ card, sym });
      if (open.length < 2) return;
      moves++;
      const [a, b] = open;
      if (a.sym === b.sym) {
        matched++;
        score += num(sc.match, 50);
        a.card.classList.add('done'); b.card.classList.add('done');
        open = [];
        top.set(1, `${matched} / ${pairs}`);
        if (matched === pairs) finish(true);
      } else {
        score = Math.max(0, score - num(sc.missPenalty, 0));
        busy = true;
        flipT = setTimeout(() => {
          for (const o of [a, b]) { o.card.classList.remove('on'); o.card.setAttribute('aria-label', '未翻開的卡牌'); }
          open = []; busy = false;
        }, 750);
      }
      top.set(2, score);
    }

    function finish(win) {
      if (ended) return;
      ended = true;
      clearInterval(timer);
      if (win) score += Math.floor(Math.max(0, left)) * num(sc.timeBonus, 0);
      done({ score, title: win ? '全部配對成功！' : '時間到！', detail: `共翻牌 ${moves} 次，配對 ${matched} / ${pairs}` });
    }
    return () => { clearInterval(timer); clearTimeout(flipT); };
  },

  /* ============ 骰運挑戰（見好就收） ============ */
  dice(area, game, diff, done) {
    const sc = game.scoring || {};
    const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    const target = Math.max(1, num(diff.targetScore, 50));
    const bust = Math.min(6, Math.max(1, num(sc.bustFace, 1)));
    let turns = Math.max(1, num(diff.turns, 8));
    let total = 0, pot = 0, rolling = null;

    const top = hud([['總分 / 目標', `0 / ${target}`], ['本回合暫存', 0], ['剩餘回合', turns]]);
    const die = h('div', { class: 'd-die', 'aria-live': 'polite' }, '🎲');
    const msg = h('p', { class: 'muted d-msg' }, `擲到 ${FACES[bust - 1]}（${bust} 點）會爆掉，暫存歸零。`);
    const rollBtn = h('button', { class: 'btn primary lg', onclick: roll }, '擲骰');
    const bankBtn = h('button', { class: 'btn ghost lg', disabled: true, onclick: bank }, '收下分數');
    area.replaceChildren(top, die, msg, h('div', { class: 'row center' }, rollBtn, bankBtn));

    const refresh = () => {
      top.set(0, `${total} / ${target}`); top.set(1, pot); top.set(2, turns);
      bankBtn.disabled = pot === 0;
    };

    function roll() {
      if (rolling) return;
      rollBtn.disabled = bankBtn.disabled = true;
      die.classList.add('spin');
      let ticks = 0;
      rolling = setInterval(() => {
        die.textContent = FACES[Math.floor(Math.random() * 6)];
        if (++ticks < 8) return;
        clearInterval(rolling); rolling = null;
        die.classList.remove('spin');
        const face = Math.floor(Math.random() * 6) + 1;
        die.textContent = FACES[face - 1];
        rollBtn.disabled = false;
        if (face === bust) {
          pot = 0;
          msg.textContent = `💥 擲到 ${face} 點爆掉了！本回合沒有得分。`;
          endTurn();
        } else {
          pot += face;
          msg.textContent = `擲出 ${face} 點，暫存 ${pot} 分。繼續擲，還是收下？`;
          refresh();
        }
      }, 70);
    }

    function bank() {
      total += pot;
      msg.textContent = `已收下 ${pot} 分。`;
      pot = 0;
      endTurn();
    }

    function endTurn() {
      turns--;
      refresh();
      if (total >= target) {
        const bonus = turns * num(sc.turnBonus, 0);
        done({ score: total + bonus, title: '達標過關！', detail: `總分 ${total}，剩餘 ${turns} 回合加 ${bonus} 分` });
      } else if (turns <= 0) {
        done({ score: total, title: '回合用完了', detail: `總分 ${total}，距離目標還差 ${target - total} 分` });
      }
    }
    return () => clearInterval(rolling);
  },
};
