/**
 * store.js — 資料層（前台與後台共用同一份邏輯）
 * ------------------------------------------------------------
 * 資料來源有兩個：
 *   1. data.json          → 「已發佈」的正式內容，所有訪客都看得到
 *   2. localStorage 草稿  → 後台按下「儲存」後寫入，只存在你自己的瀏覽器
 *
 * 讀取規則：草稿存在且不比 data.json 舊 → 用草稿（方便你即時預覽）；否則用 data.json。
 * 同步機制：草稿一被寫入，瀏覽器會對其他分頁發出 storage 事件，前台收到後自動重繪。
 */
import { clone } from './utils.js';

export const DRAFT_KEY = 'bgsite:draft:v1';
export const DATA_URL = 'data.json';

/** 資料骨架：任何缺漏的欄位都會用這裡的預設值補齊，確保前台不會因缺欄位而壞掉 */
const SKELETON = {
  meta: { version: 1, updatedAt: '' },
  site: {
    brand: { name: '我的桌遊站', logoEmoji: '🎲', logoImage: '' },
    theme: { accent: '#8b7cff', accent2: '#3ee6c1' },
    nav: [],
    hero: { eyebrow: '', title: '', subtitle: '', ctaLabel: '', ctaTarget: 'games', cta2Label: '', cta2Target: 'library', image: '' },
    announcements: [],
    features: [],
    sections: {
      featuresEyebrow: '', featuresTitle: '', featuresSubtitle: '',
      gamesEyebrow: '', gamesTitle: '互動小遊戲', gamesSubtitle: '',
      libraryEyebrow: '', libraryTitle: '桌遊百科', librarySubtitle: '',
    },
    contact: { title: '聯絡我們', intro: '', email: '', phone: '', address: '', hours: '', socials: [] },
    footer: { text: '' },
  },
  games: [],
  radarAxes: [],
  boardgames: [],
};

function merge(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : clone(def);
  if (def && typeof def === 'object') {
    const out = val && typeof val === 'object' && !Array.isArray(val) ? { ...val } : {};
    for (const k of Object.keys(def)) out[k] = merge(def[k], out[k]);
    return out;
  }
  return val === undefined || val === null ? def : val;
}

/** 以骨架補齊資料 */
export const withDefaults = (data) => merge(SKELETON, data);

/** 讀取線上正式版 data.json（加上時間參數避免瀏覽器快取舊檔） */
export async function fetchPublished() {
  const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`讀取 data.json 失敗（HTTP ${res.status}）`);
  return withDefaults(await res.json());
}

/** 讀取本機草稿；沒有或損毀時回傳 null */
export function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? withDefaults(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** 寫入本機草稿（容量不足時會丟出錯誤，由呼叫端顯示提示） */
export function writeDraft(data) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

/**
 * 載入要顯示的資料。
 * 回傳 { data, source: 'draft' | 'published' | 'empty', published, isPreview }
 */
export async function loadData() {
  let published = null;
  try { published = await fetchPublished(); } catch (err) { console.warn(err); }
  const draft = readDraft();
  const draftIsFresh = draft && (!published || (draft.meta.updatedAt || '') >= (published.meta.updatedAt || ''));
  if (draftIsFresh) {
    return { data: draft, source: 'draft', published, isPreview: !published || draft.meta.updatedAt !== published.meta.updatedAt };
  }
  if (published) return { data: published, source: 'published', published, isPreview: false };
  return { data: withDefaults({}), source: 'empty', published: null, isPreview: false };
}

/** 監聽「其他分頁修改了草稿」，前台用它做到即時同步 */
export function onDraftChange(callback) {
  window.addEventListener('storage', (e) => {
    if (e.key === DRAFT_KEY) callback();
  });
}
