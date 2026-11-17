/**
 * front/app.js — 前台主程式（完全資料驅動）
 * ------------------------------------------------------------
 * 流程：loadData() 取得資料 → render() 依資料產生整個頁面。
 * index.html 裡沒有任何寫死的內容；後台一儲存，onDraftChange 會觸發重新 render。
 */
import { loadData, onDraftChange } from '../core/store.js';
import { h, toast, safeUrl, hashHue } from '../core/utils.js';
import { radarChart } from '../core/radar.js';
import { mountGame, GAME_TYPES, getBest } from './games.js';

const root = document.getElementById('app');
let data = null;          // 目前顯示的完整資料
let isPreview = false;    // 是否正在顯示「尚未發佈的草稿」
let disposers = [];       // 重繪前要清掉的計時器等
const libState = { query: '', tag: '' }; // 桌遊百科的搜尋狀態（重繪時保留）

init();

async function init() {
  await refresh();
  // 後台在別的分頁按下儲存 → 這裡自動同步
  onDraftChange(async () => {
    await refresh();
    toast('內容已同步為後台最新版本', 'success');
  });
  // 卡片光暈跟隨游標（事件委派，重繪後仍有效）
  root.addEventListener('pointermove', (e) => {
    const card = e.target.closest?.('.glow');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}

async function refresh() {
  const res = await loadData();
  data = res.data;
  isPreview = res.isPreview && res.source === 'draft';
  if (res.source === 'empty') {
    root.replaceChildren(h('div', { class: 'boot' },
      h('h1', {}, '無法載入網站資料'),
      h('p', {}, '找不到 data.json。若你是直接雙擊開啟 index.html，請改用本機伺服器或部署上線後再開啟（詳見 README）。')));
    return;
  }
  render();
}

/* ============================================================
 * 整頁渲染
 * ============================================================ */
function render() {
  disposers.forEach((fn) => fn());
  disposers = [];
  const { site } = data;

  // 主題色與頁面標題
  document.documentElement.style.setProperty('--accent', site.theme.accent);
  document.documentElement.style.setProperty('--accent2', site.theme.accent2);
  document.title = site.brand.name + (site.hero.eyebrow ? `｜${site.hero.eyebrow}` : '');

  const y = window.scrollY;
  root.replaceChildren(
    Nav(),
    h('main', {}, Hero(), Features(), Games(), Library(), Contact()),
    Footer(),
    isPreview && h('a', { class: 'preview-pill', href: 'admin.html' }, '👀 正在預覽本機草稿（尚未發佈）'));
  window.scrollTo(0, y);
  setupReveal();
}

/** 捲動進場動畫 */
function setupReveal() {
  const els = root.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }, { threshold: 0.08 });
  els.forEach((el) => io.observe(el));
  disposers.push(() => io.disconnect());
}

const hrefOf = (target, url) => (url ? safeUrl(url) : `#${target || 'home'}`);

function sectionHead(eyebrow, title, subtitle) {
  return h('header', { class: 'sec-head reveal' },
    eyebrow && h('span', { class: 'eyebrow' }, eyebrow),
    title && h('h2', {}, title),
    subtitle && h('p', { class: 'muted' }, subtitle));
}

/* ---------------- 導覽列 ---------------- */
function Nav() {
  const { brand, nav } = data.site;
  const links = h('nav', { class: 'nav-links', id: 'nav-links' },
    nav.map((item) => h('a', {
      href: hrefOf(item.target, item.url),
      target: item.url ? '_blank' : null, rel: item.url ? 'noopener' : null,
      onclick: () => links.classList.remove('open'),
    }, item.label)));
  return h('header', { class: 'nav glass' },
    h('a', { class: 'brand', href: '#home' },
      brand.logoImage ? h('img', { src: safeUrl(brand.logoImage), alt: '' }) : h('span', { class: 'brand-emoji' }, brand.logoEmoji),
      h('span', {}, brand.name)),
    links,
    h('button', { class: 'nav-toggle', 'aria-label': '開啟選單', 'aria-controls': 'nav-links', onclick: () => links.classList.toggle('open') }, '☰'));
}

/* ---------------- 首頁主視覺 + 公告 ---------------- */
function Hero() {
  const { hero, announcements } = data.site;
  const active = announcements.filter((a) => a.active && a.text);

  // 公告輪播：每 4.5 秒換一則
  let annEl = null;
  if (active.length) {
    const tag = h('b', {}), text = h('span', {}), date = h('small', {});
    annEl = h('div', { class: 'ann glass', 'aria-live': 'polite' }, tag, text, date);
    let i = 0;
    const show = () => {
      const a = active[i % active.length];
      tag.textContent = a.tag || '公告'; text.textContent = a.text; date.textContent = a.date || '';
      annEl.classList.remove('flip'); void annEl.offsetWidth; annEl.classList.add('flip');
      i++;
    };
    show();
    if (active.length > 1) {
      const t = setInterval(show, 4500);
      disposers.push(() => clearInterval(t));
    }
  }

  const stats = [
    [data.boardgames.length, '款桌遊攻略'],
    [data.games.filter((g) => g.enabled).length, '個互動小遊戲'],
    [new Set(data.boardgames.flatMap((b) => b.mechanics || [])).size, '種遊戲機制'],
  ];

  const visual = hero.image
    ? h('img', { class: 'hero-img', src: safeUrl(hero.image), alt: '' })
    : h('div', { class: 'hero-art', 'aria-hidden': 'true' },
        ['🎲', '♟️', '🃏', '🧩', '💎'].map((e, i) => h('span', { class: `float f${i}` }, e)));

  return h('section', { class: 'hero', id: 'home' },
    h('div', { class: 'hero-copy' },
      annEl,
      hero.eyebrow && h('span', { class: 'eyebrow' }, hero.eyebrow),
      h('h1', {}, hero.title),
      hero.subtitle && h('p', { class: 'lead' }, hero.subtitle),
      h('div', { class: 'row' },
        hero.ctaLabel && h('a', { class: 'btn primary lg', href: `#${hero.ctaTarget}` }, hero.ctaLabel),
        hero.cta2Label && h('a', { class: 'btn ghost lg', href: `#${hero.cta2Target}` }, hero.cta2Label)),
      h('dl', { class: 'stats' }, stats.map(([n, label]) => h('div', {}, h('dt', {}, String(n)), h('dd', {}, label))))),
    visual);
}

/* ---------------- 特色 Bento Grid ---------------- */
function Features() {
  const { features, sections: sc } = data.site;
  if (!features.length) return null;
  return h('section', { class: 'section', id: 'features' },
    sectionHead(sc.featuresEyebrow, sc.featuresTitle, sc.featuresSubtitle),
    h('div', { class: 'bento' }, features.map((f, i) =>
      h('article', { class: `card glass glow reveal size-${f.size || 'normal'}`, style: { '--d': `${i * 60}ms` } },
        h('div', { class: 'card-icon' }, f.icon || '✨'),
        h('h3', {}, f.title),
        f.text && h('p', { class: 'muted' }, f.text)))));
}

/* ---------------- 互動小遊戲 ---------------- */
function Games() {
  const sc = data.site.sections;
  const games = data.games.filter((g) => g.enabled);
  return h('section', { class: 'section', id: 'games' },
    sectionHead(sc.gamesEyebrow, sc.gamesTitle, sc.gamesSubtitle),
    games.length
      ? h('div', { class: 'grid-3' }, games.map((g, i) => {
          const meta = GAME_TYPES[g.type] || { label: g.type, icon: '🎮' };
          const best = Math.max(0, ...(g.difficulties || []).map((d) => getBest(g, d)));
          return h('article', { class: 'card glass glow reveal game-card', style: { '--d': `${i * 60}ms` } },
            h('div', { class: 'card-icon big' }, g.icon || meta.icon),
            h('span', { class: 'badge' }, meta.label),
            h('h3', {}, g.title),
            h('p', { class: 'muted' }, g.summary),
            h('div', { class: 'game-meta' },
              h('span', {}, `${(g.difficulties || []).length || 1} 種難度`),
              best > 0 && h('span', {}, `最高分 ${best}`)),
            h('button', { class: 'btn primary', onclick: () => openGame(g) }, '開始遊戲'));
        }))
      : h('p', { class: 'empty' }, '目前沒有開放的小遊戲，敬請期待。'));
}

function openGame(game) {
  const stage = h('div', { class: 'game-stage' });
  const dispose = mountGame(stage, game);
  openModal(stage, { onClose: () => { dispose(); render(); } }); // 關閉後重繪以更新最高分
}

/* ---------------- 桌遊百科 ---------------- */
function Library() {
  const sc = data.site.sections;
  const all = data.boardgames;
  const tags = [...new Set(all.flatMap((b) => b.mechanics || []))];
  if (libState.tag && !tags.includes(libState.tag)) libState.tag = '';

  const grid = h('div', { class: 'grid-3' });
  const tagBar = h('div', { class: 'chips' });

  const draw = () => {
    const q = libState.query.trim().toLowerCase();
    const list = all.filter((b) =>
      (!libState.tag || (b.mechanics || []).includes(libState.tag)) &&
      (!q || [b.name, b.nameEn, b.tagline, ...(b.mechanics || [])].join(' ').toLowerCase().includes(q)));
    grid.replaceChildren(...(list.length
      ? list.map((b) => BoardgameCard(b))
      : [h('p', { class: 'empty' }, '找不到符合條件的桌遊，換個關鍵字試試。')]));
    tagBar.replaceChildren(
      ...['', ...tags].map((t) => h('button', {
        class: 'chip' + (libState.tag === t ? ' active' : ''), type: 'button',
        'aria-pressed': String(libState.tag === t),
        onclick: () => { libState.tag = t; draw(); },
      }, t || '全部')));
  };
  draw();

  return h('section', { class: 'section', id: 'library' },
    sectionHead(sc.libraryEyebrow, sc.libraryTitle, sc.librarySubtitle),
    h('div', { class: 'lib-tools reveal' },
      h('input', { class: 'search glass', type: 'search', placeholder: '搜尋桌遊名稱或機制…', 'aria-label': '搜尋桌遊', value: libState.query,
        oninput: (e) => { libState.query = e.target.value; draw(); } }),
      tagBar),
    grid);
}

/** 桌遊封面：有圖用圖，沒圖用名稱算出的漸層 + emoji */
function Cover(b) {
  const fallback = () => h('div', { class: 'cover gen', style: { '--hue': hashHue(b.name) } }, h('span', {}, b.emoji || '🎲'));
  if (!b.image) return fallback();
  const img = h('img', { class: 'cover', src: safeUrl(b.image), alt: `${b.name} 封面`, loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(fallback())); // 圖片路徑錯誤時自動改用漸層封面
  return img;
}

const range = (a, b, unit) => (a === b || b == null ? `${a}${unit}` : `${a}–${b}${unit}`);

function BoardgameCard(b) {
  return h('article', { class: 'card glass glow bg-card in', tabIndex: 0, role: 'button', 'aria-label': `查看 ${b.name} 攻略`,
      onclick: () => openBoardgame(b),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBoardgame(b); } } },
    Cover(b),
    b.featured && h('span', { class: 'badge hot' }, '精選'),
    h('div', { class: 'bg-body' },
      h('h3', {}, b.name, b.nameEn && h('small', {}, b.nameEn)),
      b.tagline && h('p', { class: 'muted' }, b.tagline),
      h('div', { class: 'game-meta' },
        h('span', {}, `👥 ${range(b.playersMin, b.playersMax, ' 人')}`),
        h('span', {}, `⏱ ${range(b.timeMin, b.timeMax, ' 分')}`)),
      h('div', { class: 'chips sm' }, (b.mechanics || []).map((m) => h('span', { class: 'chip static' }, m)))));
}

function openBoardgame(b) {
  const list = (title, items, cls) => items?.length
    ? h('section', { class: `tipbox ${cls}` }, h('h4', {}, title), h('ul', {}, items.map((t) => h('li', {}, t))))
    : null;
  openModal(h('article', { class: 'detail' },
    Cover(b),
    h('div', { class: 'detail-head' },
      h('h2', {}, b.name, b.nameEn && h('small', {}, b.nameEn)),
      b.tagline && h('p', { class: 'lead' }, b.tagline),
      h('div', { class: 'game-meta' },
        h('span', {}, `👥 ${range(b.playersMin, b.playersMax, ' 人')}`),
        h('span', {}, `⏱ ${range(b.timeMin, b.timeMax, ' 分鐘')}`)),
      h('div', { class: 'chips sm' }, (b.mechanics || []).map((m) => h('span', { class: 'chip static' }, m)))),
    h('div', { class: 'detail-grid' },
      h('div', {}, b.description && h('p', {}, b.description), list('🪤 新手陷阱', b.pitfalls, 'warn'), list('🏆 進階心法', b.tips, 'ok')),
      h('div', { class: 'radar-box glass' }, h('h4', {}, '策略雷達圖'), radarChart(data.radarAxes, b.ratings)))),
  { wide: true });
}

/* ---------------- 聯絡資訊 / 頁尾 ---------------- */
function Contact() {
  const c = data.site.contact;
  const rows = [
    c.email && ['✉️', 'Email', h('a', { href: `mailto:${c.email}` }, c.email)],
    c.phone && ['📞', '電話', h('a', { href: `tel:${c.phone.replace(/[^\d+]/g, '')}` }, c.phone)],
    c.address && ['📍', '地址', c.address],
    c.hours && ['🕒', '服務時間', c.hours],
  ].filter(Boolean);
  return h('section', { class: 'section', id: 'contact' },
    h('div', { class: 'card glass contact reveal' },
      h('div', {},
        h('h2', {}, c.title),
        c.intro && h('p', { class: 'muted' }, c.intro),
        h('div', { class: 'chips' }, c.socials.filter((x) => x.label && safeUrl(x.url)).map((x) =>
          h('a', { class: 'chip', href: safeUrl(x.url), target: '_blank', rel: 'noopener' }, x.label, ' ↗')))),
      h('ul', { class: 'contact-list' }, rows.map(([icon, label, value]) =>
        h('li', {}, h('span', { class: 'card-icon' }, icon), h('div', {}, h('small', {}, label), h('div', {}, value)))))));
}

function Footer() {
  return h('footer', { class: 'footer' }, h('span', {}, data.site.footer.text), h('a', { href: 'admin.html' }, '後台管理'));
}

/* ---------------- 共用彈出視窗 ---------------- */
function openModal(content, { onClose, wide } = {}) {
  const dlg = h('dialog', { class: 'modal' + (wide ? ' wide' : '') },
    h('div', { class: 'modal-body glass' },
      h('button', { class: 'modal-close', 'aria-label': '關閉', onclick: () => dlg.close() }, '✕'),
      content));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // 點背景關閉
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}
