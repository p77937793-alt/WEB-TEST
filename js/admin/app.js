/**
 * admin/app.js — 後台主程式
 * ------------------------------------------------------------
 * 狀態：
 *   state.data      正在編輯的資料（表單直接改這個物件）
 *   state.savedJson 上次儲存時的內容（用來判斷「有沒有未儲存的變更」）
 *
 * 資料流：表單輸入 → 改 state.data → 按「儲存變更」→ 驗證 → 寫入 localStorage 草稿
 *         → 前台分頁收到 storage 事件自動重繪 → 到「發佈與備份」更新線上的 data.json
 */
import { loadData, writeDraft } from '../core/store.js';
import { h, toast, clone, uid, confirmDialog } from '../core/utils.js';
import { renderFields, validateFields } from './forms.js';
import { SITE_TABS, gameFields, newGame, BOARDGAME_FIELDS, newBoardgame, AXES_FIELDS } from './schemas.js';
import { renderPublish } from './publish.js';
import { GAME_TYPES } from '../front/games.js';

const VIEWS = [
  { id: 'dashboard', icon: '🏠', label: '總覽' },
  { id: 'site', icon: '🌐', label: '全域內容' },
  { id: 'games', icon: '🎮', label: '小遊戲' },
  { id: 'boardgames', icon: '📚', label: '桌遊百科' },
  { id: 'publish', icon: '🚀', label: '發佈與備份' },
];

const state = {
  data: null,
  savedJson: '',
  source: 'published',
  view: 'dashboard',
  siteTab: 'brand',
  sel: { games: 0, boardgames: 0 },   // 各列表目前選到第幾筆
  bgTab: 'items',
  showErrors: false,                  // 儲存失敗後，讓所有欄位顯示錯誤
};

const root = document.getElementById('admin');
let viewEl, statusEl, saveBtn, discardBtn, navBtns;

const isDirty = () => JSON.stringify(state.data) !== state.savedJson;

init();

async function init() {
  const res = await loadData();
  state.data = res.data;
  state.source = res.source;
  state.savedJson = JSON.stringify(state.data);
  buildShell();
  go(location.hash.slice(1) || 'dashboard');
  if (res.source === 'empty') toast('找不到 data.json，已從空白內容開始', 'info');

  // Ctrl/Cmd + S 儲存
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  // 有未儲存變更時，離開頁面前提醒
  window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
}

/* ============================================================
 * 外框：側邊選單 + 頂部工具列
 * ============================================================ */
function buildShell() {
  navBtns = VIEWS.map((v) => h('button', { class: 'side-link', onclick: () => go(v.id) }, h('span', {}, v.icon), h('em', {}, v.label)));
  statusEl = h('span', { class: 'status' });
  discardBtn = h('button', { class: 'btn ghost', onclick: discard }, '捨棄變更');
  saveBtn = h('button', { class: 'btn primary', onclick: save, title: 'Ctrl / ⌘ + S' }, '儲存變更');
  viewEl = h('div', { class: 'view' });

  root.replaceChildren(
    h('aside', { class: 'side glass' },
      h('div', { class: 'side-brand' }, h('span', {}, '⚙️'), h('b', {}, '網站後台')),
      h('nav', {}, navBtns),
      h('a', { class: 'side-link preview', href: 'index.html', target: '_blank', rel: 'noopener' }, h('span', {}, '↗'), h('em', {}, '開啟前台'))),
    h('div', { class: 'main' },
      h('header', { class: 'topbar glass' },
        h('h1', { id: 'view-title' }),
        h('div', { class: 'row' }, statusEl, discardBtn, saveBtn)),
      viewEl));
  updateStatus();
}

function updateStatus() {
  const dirty = isDirty();
  statusEl.textContent = dirty ? '● 有未儲存的變更' : '✓ 已儲存';
  statusEl.className = 'status ' + (dirty ? 'dirty' : 'clean');
  saveBtn.disabled = discardBtn.disabled = !dirty;
}

/** 表單任何欄位改變時呼叫 */
function onChange() { updateStatus(); }

/** 切換頁面 */
function go(view) {
  state.view = VIEWS.some((v) => v.id === view) ? view : 'dashboard';
  history.replaceState(null, '', `#${state.view}`);
  navBtns.forEach((b, i) => b.classList.toggle('active', VIEWS[i].id === state.view));
  document.getElementById('view-title').textContent = VIEWS.find((v) => v.id === state.view).label;
  renderView();
}

function renderView() {
  const ctx = { onChange, showErrors: state.showErrors, data: state.data };
  const views = { dashboard: Dashboard, site: SiteView, games: GamesView, boardgames: BoardgamesView, publish: PublishView };
  viewEl.replaceChildren(views[state.view](ctx));
  viewEl.scrollTop = 0;
}

/* ============================================================
 * 儲存 / 捨棄 / 驗證
 * ============================================================ */
/** 檢查全部資料，回傳 [{ msg, view, tab, index }] */
function validateAll() {
  const d = state.data, out = [];
  for (const tab of SITE_TABS) {
    for (const msg of validateFields(tab.fields, d.site)) out.push({ msg: `全域內容・${msg}`, view: 'site', tab: tab.id });
  }
  d.games.forEach((g, i) => {
    for (const msg of validateFields(gameFields(g), g)) out.push({ msg: `小遊戲「${g.title || '未命名'}」・${msg}`, view: 'games', index: i });
  });
  d.boardgames.forEach((b, i) => {
    for (const msg of validateFields(BOARDGAME_FIELDS, b)) out.push({ msg: `桌遊「${b.name || '未命名'}」・${msg}`, view: 'boardgames', tab: 'items', index: i });
  });
  for (const msg of validateFields(AXES_FIELDS, d)) out.push({ msg: `桌遊百科・${msg}`, view: 'boardgames', tab: 'axes' });
  return out;
}

/** 儲存：成功回傳 true */
function save() {
  if (!isDirty()) return true;
  const errors = validateAll();
  if (errors.length) {
    // 自動跳到第一個有問題的地方，並顯示所有欄位的錯誤
    const first = errors[0];
    state.showErrors = true;
    if (first.view === 'site') state.siteTab = first.tab;
    if (first.view === 'boardgames') state.bgTab = first.tab;
    if (first.index != null) state.sel[first.view] = first.index;
    go(first.view);
    toast(`還有 ${errors.length} 個欄位需要修正。${first.msg}`, 'error');
    return false;
  }
  try {
    state.data.meta.updatedAt = new Date().toISOString();
    writeDraft(state.data);
    state.savedJson = JSON.stringify(state.data);
    state.showErrors = false;
    updateStatus();
    toast('儲存成功！前台已同步更新（發佈後訪客才看得到）', 'success');
    return true;
  } catch (err) {
    const full = err?.name === 'QuotaExceededError';
    toast(full ? '儲存失敗：瀏覽器空間不足。請減少內嵌的上傳圖片，或改填圖片路徑。' : `儲存失敗：${err.message}`, 'error');
    return false;
  }
}

async function discard() {
  if (!isDirty()) return;
  if (!(await confirmDialog('確定要捨棄所有尚未儲存的變更嗎？', { okLabel: '捨棄', danger: true }))) return;
  state.data = JSON.parse(state.savedJson);
  state.showErrors = false;
  updateStatus();
  renderView();
  toast('已還原到上次儲存的內容', 'info');
}

/* ============================================================
 * 總覽
 * ============================================================ */
function Dashboard() {
  const d = state.data;
  const stat = (n, label, view) => h('button', { class: 'stat-card glass', onclick: () => go(view) }, h('b', {}, String(n)), h('span', {}, label));
  const updated = d.meta.updatedAt ? new Date(d.meta.updatedAt).toLocaleString('zh-TW') : '—';
  return h('div', { class: 'stack' },
    h('div', { class: 'stat-grid' },
      stat(d.boardgames.length, '款桌遊', 'boardgames'),
      stat(d.games.length, '個小遊戲', 'games'),
      stat(d.games.reduce((n, g) => n + (g.questions?.length || 0), 0), '題問答題庫', 'games'),
      stat(d.site.announcements.filter((a) => a.active).length, '則顯示中公告', 'site')),
    h('section', { class: 'panel glass' },
      h('h3', {}, '目前狀態'),
      h('p', {}, '內容最後修改時間：', h('b', {}, updated)),
      h('p', { class: 'muted' }, state.source === 'draft'
        ? '你正在編輯這台裝置上的草稿。修改完成後，記得到「發佈與備份」讓訪客看到最新內容。'
        : '目前內容與線上的 data.json 相同。')),
    h('section', { class: 'panel glass' },
      h('h3', {}, '三步驟更新網站'),
      h('ol', { class: 'steps' },
        h('li', {}, h('b', {}, '編輯'), '：從左側選單進入「全域內容 / 小遊戲 / 桌遊百科」修改內容。'),
        h('li', {}, h('b', {}, '儲存'), '：按右上角「儲存變更」。此時開著的前台分頁會立刻同步，讓你先預覽。'),
        h('li', {}, h('b', {}, '發佈'), '：到「發佈與備份」按「發佈上線」，所有訪客就會看到新內容。'))));
}

/* ============================================================
 * 模組 A：全域內容
 * ============================================================ */
function SiteView(ctx) {
  const tab = SITE_TABS.find((t) => t.id === state.siteTab) || SITE_TABS[0];
  return h('div', { class: 'stack' },
    Tabs(SITE_TABS, tab.id, (id) => { state.siteTab = id; renderView(); }),
    h('section', { class: 'panel glass' }, renderFields(tab.fields, state.data.site, ctx)));
}

function Tabs(tabs, activeId, onPick) {
  return h('div', { class: 'tabs', role: 'tablist' }, tabs.map((t) =>
    h('button', { class: 'tab' + (t.id === activeId ? ' active' : ''), role: 'tab', 'aria-selected': String(t.id === activeId), onclick: () => onPick(t.id) }, t.label)));
}

/* ============================================================
 * 通用「左側列表 + 右側編輯」介面（小遊戲與桌遊共用）
 * ============================================================ */
function Collection({ key, items, ctx, titleOf, subOf, iconOf, fieldsOf, addButtons, noun }) {
  const listEl = h('div', { class: 'md-list' });
  const detailEl = h('div', { class: 'md-detail' });
  const clamp = () => { state.sel[key] = Math.min(Math.max(0, state.sel[key]), items.length - 1); };

  const drawList = () => {
    clamp();
    listEl.replaceChildren(
      ...items.map((item, i) => h('button', { class: 'md-item' + (i === state.sel[key] ? ' active' : ''), onclick: () => { state.sel[key] = i; draw(); } },
        h('span', { class: 'md-icon' }, iconOf(item)),
        h('span', { class: 'md-text' }, h('b', {}, titleOf(item) || '（未命名）'), h('small', {}, subOf(item))))),
      h('div', { class: 'md-add' }, addButtons.map(([label, make]) =>
        h('button', { class: 'btn sm', onclick: () => { items.push(make()); state.sel[key] = items.length - 1; onChange(); draw(); toast(`已新增${noun}，填寫完成後記得儲存`, 'info'); } }, label))));
  };

  const drawDetail = () => {
    const i = state.sel[key], item = items[i];
    if (!item) { detailEl.replaceChildren(h('section', { class: 'panel glass' }, h('p', { class: 'empty' }, `還沒有任何${noun}，從左側按鈕新增第一筆吧。`))); return; }
    const move = (to) => { items.splice(to, 0, items.splice(i, 1)[0]); state.sel[key] = to; onChange(); draw(); };
    detailEl.replaceChildren(h('section', { class: 'panel glass' },
      h('div', { class: 'panel-head' },
        h('h3', {}, `編輯${noun}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn sm ghost', disabled: i === 0, onclick: () => move(i - 1) }, '↑ 上移'),
          h('button', { class: 'btn sm ghost', disabled: i === items.length - 1, onclick: () => move(i + 1) }, '↓ 下移'),
          h('button', { class: 'btn sm ghost', onclick: () => {
            const copy = { ...clone(item), id: uid(key === 'games' ? 'game' : 'bg') };
            if ('title' in copy) copy.title += '（副本）'; else copy.name += '（副本）';
            items.splice(i + 1, 0, copy); state.sel[key] = i + 1; onChange(); draw();
          } }, '⧉ 複製'),
          h('button', { class: 'btn sm danger', onclick: async () => {
            if (!(await confirmDialog(`確定要刪除「${titleOf(item)}」嗎？`, { okLabel: '刪除', danger: true }))) return;
            items.splice(i, 1); onChange(); draw(); toast(`已刪除，按「儲存變更」後生效`, 'info');
          } }, '🗑 刪除'))),
      // 欄位改變時同步更新左側列表的名稱
      renderFields(fieldsOf(item), item, { ...ctx, onChange: () => { onChange(); drawList(); } })));
  };

  const draw = () => { drawList(); drawDetail(); };
  draw();
  return h('div', { class: 'md' }, listEl, detailEl);
}

/* ============================================================
 * 模組 B：小遊戲控制台
 * ============================================================ */
function GamesView(ctx) {
  return Collection({
    key: 'games', items: state.data.games, ctx, noun: '小遊戲',
    titleOf: (g) => g.title,
    subOf: (g) => `${GAME_TYPES[g.type]?.label || g.type}・${g.enabled ? '已上架' : '未上架'}`,
    iconOf: (g) => g.icon || GAME_TYPES[g.type]?.icon || '🎮',
    fieldsOf: gameFields,
    addButtons: Object.entries(GAME_TYPES).map(([type, m]) => [`＋ ${m.label}`, () => newGame(type)]),
  });
}

/* ============================================================
 * 模組 C：桌遊百科
 * ============================================================ */
function BoardgamesView(ctx) {
  const tabs = [{ id: 'items', label: '桌遊列表' }, { id: 'axes', label: '雷達圖面向設定' }];
  const body = state.bgTab === 'axes'
    ? h('section', { class: 'panel glass' },
        h('p', { class: 'muted' }, '這裡決定雷達圖有哪些評分面向（3–8 個）。新增面向後，每款桌遊都會多一個評分滑桿，預設 5 分。'),
        renderFields(AXES_FIELDS, state.data, {
          ...ctx,
          onChange: () => {
            // 新增的面向需要一個固定的 key，讓各桌遊的評分能對應到它
            for (const a of state.data.radarAxes) if (!a.key) a.key = a.id || uid('axis');
            onChange();
          },
        }))
    : Collection({
        key: 'boardgames', items: state.data.boardgames, ctx, noun: '桌遊',
        titleOf: (b) => b.name,
        subOf: (b) => (b.mechanics || []).slice(0, 2).join('・') || '尚未設定機制',
        iconOf: (b) => b.emoji || '🎲',
        fieldsOf: () => BOARDGAME_FIELDS,
        addButtons: [['＋ 新增桌遊', () => newBoardgame(state.data)]],
      });
  return h('div', { class: 'stack' }, Tabs(tabs, state.bgTab, (id) => { state.bgTab = id; renderView(); }), body);
}

/* ============================================================
 * 發佈與備份
 * ============================================================ */
function PublishView() {
  return renderPublish({
    getData: () => state.data,
    rerender: renderView,
    // 發佈前先確保內容已通過驗證並儲存
    ensureSaved: async () => save(),
    // 匯入或還原時，整份資料換掉
    replaceData: (data, message, markSaved = false) => {
      state.data = data;
      if (markSaved) state.savedJson = JSON.stringify(data);
      state.showErrors = false;
      updateStatus();
      renderView();
      toast(message, 'success');
    },
  });
}
