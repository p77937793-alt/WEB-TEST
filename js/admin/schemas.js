/**
 * admin/schemas.js — 後台「有哪些欄位可以編輯」的唯一定義處
 * ------------------------------------------------------------
 * 每個欄位定義對應 data.json 的一個 key。表單、驗證、預設值都從這裡來。
 * 想新增可編輯欄位：在對應陣列加一個 { key, label, type }，
 * 再到前台 (js/front/app.js) 用 data.xxx.key 顯示它即可。
 */
import { uid } from '../core/utils.js';

/** 前台可以連結的區塊（導覽列與按鈕用） */
const SECTIONS = [
  { value: 'home', label: '首頁主視覺' },
  { value: 'features', label: '特色區塊' },
  { value: 'games', label: '互動小遊戲' },
  { value: 'library', label: '桌遊百科' },
  { value: 'contact', label: '聯絡資訊' },
];

/* ============================================================
 * 模組 A：網站全域內容（對應 data.site）
 * ============================================================ */
export const SITE_TABS = [
  { id: 'brand', label: '品牌與主題', fields: [
    { key: 'brand', label: '品牌', type: 'group', fields: [
      { key: 'name', label: '網站名稱', required: true, maxLength: 40 },
      { key: 'logoEmoji', label: 'Logo 表情符號', help: '沒有 Logo 圖片時顯示', maxLength: 4 },
      { key: 'logoImage', label: 'Logo 圖片（選填）', type: 'image' },
    ] },
    { key: 'theme', label: '主題色', type: 'group', fields: [
      { key: 'accent', label: '主色', type: 'color' },
      { key: 'accent2', label: '輔色', type: 'color' },
    ] },
  ] },
  { id: 'nav', label: '導覽列', fields: [
    { key: 'nav', label: '導覽連結', type: 'repeater', itemName: '連結', idPrefix: 'nav',
      itemTitle: (x) => x.label || '（未命名連結）', newItem: { label: '新連結', target: 'home', url: '' },
      fields: [
        { key: 'label', label: '顯示文字', required: true, maxLength: 20 },
        { key: 'target', label: '連到哪個區塊', type: 'select', options: SECTIONS },
        { key: 'url', label: '外部網址（選填）', type: 'url', full: true, help: '填寫後會改為開新分頁前往這個網址' },
      ] },
  ] },
  { id: 'hero', label: '首頁主視覺', fields: [
    { key: 'hero', label: '主視覺', type: 'group', fields: [
      { key: 'eyebrow', label: '小標', maxLength: 40 },
      { key: 'title', label: '主標語', required: true, maxLength: 60 },
      { key: 'subtitle', label: '副標語', type: 'textarea', maxLength: 200 },
      { key: 'ctaLabel', label: '主要按鈕文字' },
      { key: 'ctaTarget', label: '主要按鈕連到', type: 'select', options: SECTIONS },
      { key: 'cta2Label', label: '次要按鈕文字' },
      { key: 'cta2Target', label: '次要按鈕連到', type: 'select', options: SECTIONS },
      { key: 'image', label: '主視覺圖片（選填，未設定時顯示動態圖示）', type: 'image' },
    ] },
  ] },
  { id: 'ann', label: '公告', fields: [
    { key: 'announcements', label: '公告列表', type: 'repeater', itemName: '公告', idPrefix: 'ann',
      itemTitle: (x) => `${x.active ? '🟢' : '⚪'} ${x.text || '（空白公告）'}`,
      newItem: { tag: '公告', text: '', date: new Date().toISOString().slice(0, 10), active: true },
      fields: [
        { key: 'text', label: '公告內容', required: true, full: true, maxLength: 120 },
        { key: 'tag', label: '標籤', placeholder: '例如：活動、新上架', maxLength: 10 },
        { key: 'date', label: '日期', placeholder: '2026-11-17', maxLength: 20 },
        { key: 'active', label: '顯示狀態', type: 'toggle', onLabel: '在前台顯示' },
      ] },
  ] },
  { id: 'features', label: '特色區塊', fields: [
    { key: 'features', label: '特色卡片（Bento Grid）', type: 'repeater', itemName: '卡片', idPrefix: 'ft',
      itemTitle: (x) => `${x.icon || '✨'} ${x.title || '（未命名）'}`, newItem: { icon: '✨', title: '新特色', text: '', size: 'normal' },
      fields: [
        { key: 'title', label: '標題', required: true, maxLength: 30 },
        { key: 'icon', label: '圖示（表情符號）', maxLength: 4 },
        { key: 'text', label: '說明', type: 'textarea', maxLength: 160 },
        { key: 'size', label: '卡片大小', type: 'select', options: [
          { value: 'normal', label: '標準（1 格）' }, { value: 'wide', label: '寬版（橫跨 2 格）' },
          { value: 'tall', label: '高版（直跨 2 格）' }, { value: 'large', label: '大型（2×2 格）' }] },
      ] },
  ] },
  { id: 'sections', label: '區塊標題', fields: [
    { key: 'sections', label: '各區塊的標題文字', type: 'group', fields: [
      { key: 'featuresEyebrow', label: '特色區塊・小標' }, { key: 'featuresTitle', label: '特色區塊・標題' },
      { key: 'featuresSubtitle', label: '特色區塊・說明', full: true },
      { key: 'gamesEyebrow', label: '小遊戲・小標' }, { key: 'gamesTitle', label: '小遊戲・標題', required: true },
      { key: 'gamesSubtitle', label: '小遊戲・說明', full: true },
      { key: 'libraryEyebrow', label: '桌遊百科・小標' }, { key: 'libraryTitle', label: '桌遊百科・標題', required: true },
      { key: 'librarySubtitle', label: '桌遊百科・說明', full: true },
    ] },
  ] },
  { id: 'contact', label: '聯絡資訊', fields: [
    { key: 'contact', label: '聯絡資訊', type: 'group', fields: [
      { key: 'title', label: '區塊標題', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'intro', label: '簡介', type: 'textarea' },
      { key: 'phone', label: '電話' },
      { key: 'hours', label: '服務時間' },
      { key: 'address', label: '地址', full: true },
      { key: 'socials', label: '社群連結', type: 'repeater', itemName: '社群連結', idPrefix: 'so',
        itemTitle: (x) => x.label || '（未命名）', newItem: { label: '', url: '' },
        fields: [
          { key: 'label', label: '名稱', required: true, placeholder: 'Instagram' },
          { key: 'url', label: '網址', type: 'url', required: true, placeholder: 'https://' },
        ] },
    ] },
  ] },
  { id: 'footer', label: '頁尾', fields: [
    { key: 'footer', label: '頁尾', type: 'group', fields: [{ key: 'text', label: '版權文字', full: true }] },
  ] },
];

/* ============================================================
 * 模組 B：互動小遊戲（對應 data.games 的每一筆）
 * ============================================================ */
const pts = (key, label, help) => ({ key, label, type: 'number', min: 0, max: 100000, required: true, help });
const diffRepeater = (fields, newItem) => ({
  key: 'difficulties', label: '難易度與關卡參數', type: 'repeater', itemName: '難度', idPrefix: 'd', minItems: 1,
  itemTitle: (x) => x.label || '（未命名難度）', newItem,
  fields: [{ key: 'label', label: '難度名稱', required: true, maxLength: 12 }, ...fields],
});

const GAME_COMMON = [
  { key: 'title', label: '遊戲名稱', required: true, maxLength: 30 },
  { key: 'icon', label: '圖示（表情符號）', maxLength: 4 },
  { key: 'summary', label: '一句話介紹', type: 'textarea', rows: 2, maxLength: 120 },
  { key: 'enabled', label: '上架狀態', type: 'toggle', onLabel: '在前台開放遊玩' },
  { key: 'rules', label: '遊戲規則說明', type: 'lines', help: '每行一條規則，會以編號清單顯示在開始畫面' },
];

const GAME_BY_TYPE = {
  quiz: [
    diffRepeater([
      { key: 'questionCount', label: '每局題數', type: 'number', min: 1, max: 50, required: true },
      { key: 'timePerQuestion', label: '每題秒數', type: 'number', min: 3, max: 120, required: true },
    ], { label: '新難度', questionCount: 5, timePerQuestion: 15 }),
    { key: 'scoring', label: '計分規則', type: 'group', fields: [
      pts('correct', '答對得分'), pts('timeBonus', '每剩 1 秒加分'), pts('wrongPenalty', '答錯 / 超時扣分'),
    ] },
    { key: 'questions', label: '題庫', type: 'repeater', itemName: '題目', idPrefix: 'q', minItems: 1,
      itemTitle: (x) => x.q || '（尚未輸入題目）',
      newItem: { q: '', options: ['選項一', '選項二', '選項三', '選項四'], answer: 0, explain: '' },
      fields: [
        { key: 'q', label: '題目', type: 'textarea', rows: 2, required: true },
        { key: 'options', label: '選項（每行一個，2–6 個）', type: 'lines', minItems: 2, maxItems: 6 },
        { key: 'answer', label: '正確答案', type: 'select', full: true,
          options: [0, 1, 2, 3, 4, 5].map((i) => ({ value: i, label: `第 ${i + 1} 個選項（${'ABCDEF'[i]}）` })),
          validate: (v, q) => (v < (q.options || []).length ? '' : '正確答案超出了選項數量') },
        { key: 'explain', label: '答案解說（選填）', type: 'textarea', rows: 2 },
      ] },
  ],
  memory: [
    diffRepeater([
      { key: 'pairs', label: '配對組數', type: 'number', min: 2, max: 18, required: true },
      { key: 'timeLimit', label: '時間限制（秒）', type: 'number', min: 10, max: 600, required: true },
    ], { label: '新難度', pairs: 6, timeLimit: 60 }),
    { key: 'scoring', label: '計分規則', type: 'group', fields: [
      pts('match', '配對成功得分'), pts('missPenalty', '翻錯扣分'), pts('timeBonus', '過關後每剩 1 秒加分'),
    ] },
    { key: 'symbols', label: '翻牌圖案', type: 'tags', minItems: 2, help: '建議使用表情符號；圖案數量需不少於最大的「配對組數」',
      validate: (v, g) => {
        const need = Math.max(0, ...(g.difficulties || []).map((d) => d.pairs || 0));
        return (v || []).length >= need ? '' : `最高難度需要 ${need} 組配對，圖案至少要 ${need} 個`;
      } },
  ],
  dice: [
    diffRepeater([
      { key: 'targetScore', label: '目標分數', type: 'number', min: 5, max: 9999, required: true },
      { key: 'turns', label: '回合數', type: 'number', min: 1, max: 50, required: true },
    ], { label: '新難度', targetScore: 50, turns: 8 }),
    { key: 'scoring', label: '計分規則', type: 'group', fields: [
      { key: 'bustFace', label: '爆掉的點數', type: 'select', options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 點` })) },
      pts('turnBonus', '過關後每剩 1 回合加分'),
    ] },
  ],
};

export const gameFields = (game) => [...GAME_COMMON, ...(GAME_BY_TYPE[game.type] || [])];

/** 新增遊戲時的範本 */
export function newGame(type) {
  const base = { id: uid('game'), type, enabled: false, rules: [] };
  const d = (label, extra) => ({ id: uid('d'), label, ...extra });
  if (type === 'quiz') return { ...base, title: '新的知識問答', icon: '🧠', summary: '', difficulties: [d('標準', { questionCount: 5, timePerQuestion: 15 })],
    scoring: { correct: 100, timeBonus: 5, wrongPenalty: 0 },
    questions: [{ id: uid('q'), q: '範例題目：一顆標準骰子有幾個面？', options: ['4', '6', '8', '12'], answer: 1, explain: '' }] };
  if (type === 'memory') return { ...base, title: '新的記憶翻牌', icon: '🃏', summary: '', difficulties: [d('標準', { pairs: 6, timeLimit: 60 })],
    scoring: { match: 50, missPenalty: 5, timeBonus: 3 }, symbols: ['🎲', '♟️', '🃏', '🧩', '🏰', '💎'] };
  return { ...base, title: '新的骰運挑戰', icon: '🎯', summary: '', difficulties: [d('標準', { targetScore: 50, turns: 8 })],
    scoring: { bustFace: 1, turnBonus: 10 } };
}

/* ============================================================
 * 模組 C：桌遊百科（對應 data.boardgames 的每一筆）
 * ============================================================ */
export const BOARDGAME_FIELDS = [
  { key: 'name', label: '桌遊名稱', required: true, maxLength: 40 },
  { key: 'nameEn', label: '英文 / 原文名稱', maxLength: 60 },
  { key: 'tagline', label: '一句話特色', maxLength: 60 },
  { key: 'emoji', label: '封面表情符號', help: '沒有圖片時顯示', maxLength: 4 },
  { key: 'image', label: '封面圖片', type: 'image' },
  { key: 'description', label: '遊戲介紹', type: 'textarea', rows: 4 },
  { key: 'mechanics', label: '機制標籤', type: 'tags', help: '前台會自動把這些標籤變成篩選按鈕' },
  { key: 'playersMin', label: '最少人數', type: 'number', min: 1, max: 99, required: true },
  { key: 'playersMax', label: '最多人數', type: 'number', min: 1, max: 99, required: true,
    validate: (v, b) => (v >= b.playersMin ? '' : '最多人數不可小於最少人數') },
  { key: 'timeMin', label: '最短時間（分鐘）', type: 'number', min: 1, max: 999, required: true },
  { key: 'timeMax', label: '最長時間（分鐘）', type: 'number', min: 1, max: 999, required: true,
    validate: (v, b) => (v >= b.timeMin ? '' : '最長時間不可小於最短時間') },
  { key: 'featured', label: '精選', type: 'toggle', onLabel: '在卡片上顯示「精選」標章' },
  { key: 'ratings', label: '雷達圖策略評分（0–10）', type: 'ratings' },
  { key: 'pitfalls', label: '新手陷阱', type: 'lines', help: '每行一條' },
  { key: 'tips', label: '進階心法', type: 'lines', help: '每行一條' },
];

export const newBoardgame = (data) => ({
  id: uid('bg'), name: '新桌遊', nameEn: '', emoji: '🎲', image: '', tagline: '', description: '', mechanics: [],
  playersMin: 2, playersMax: 4, timeMin: 30, timeMax: 60, featured: false,
  ratings: Object.fromEntries((data.radarAxes || []).map((a) => [a.key, 5])), pitfalls: [], tips: [],
});

/** 雷達圖的評分面向（對應 data.radarAxes） */
export const AXES_FIELDS = [
  { key: 'radarAxes', label: '雷達圖評分面向', type: 'repeater', itemName: '面向', idPrefix: 'axis', minItems: 3, maxItems: 8,
    itemTitle: (x) => x.label || '（未命名面向）', newItem: { label: '新面向' },
    fields: [{ key: 'label', label: '面向名稱', required: true, maxLength: 8, full: true }] },
];
