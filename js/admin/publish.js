/**
 * admin/publish.js — 「發佈與備份」頁
 * ------------------------------------------------------------
 * 後台的「儲存」只寫進你這台瀏覽器；要讓所有訪客看到，必須更新主機上的 data.json。
 * 這裡提供三條路：
 *   1. GitHub 一鍵發佈：呼叫 GitHub API 直接把 data.json 提交到你的儲存庫（推薦）
 *   2. 直接寫入本機檔案：用瀏覽器的檔案存取功能覆寫專案資料夾裡的 data.json
 *   3. 下載 data.json：手動上傳到任何主機
 */
import { h, toast, downloadText, confirmDialog } from '../core/utils.js';
import { withDefaults, clearDraft, fetchPublished } from '../core/store.js';

const GH_KEY = 'bgsite:github:v1';
const readGh = () => { try { return JSON.parse(localStorage.getItem(GH_KEY)) || {}; } catch { return {}; } };

/** 把 UTF-8 文字轉成 base64（GitHub API 要求的格式，需正確處理中文） */
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 透過 GitHub Contents API 建立或更新檔案 */
async function githubPublish({ owner, repo, branch, path, token }, json) {
  const enc = encodeURIComponent;
  const api = `https://api.github.com/repos/${enc(owner)}/${enc(repo)}/contents/${path.split('/').map(enc).join('/')}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };

  // 先取得現有檔案的 sha（更新檔案時必須附上）
  let sha;
  const cur = await fetch(`${api}?ref=${enc(branch)}`, { headers, cache: 'no-store' });
  if (cur.ok) sha = (await cur.json()).sha;
  else if (cur.status === 401) throw new Error('存取權杖無效或已過期');
  else if (cur.status !== 404) throw new Error(`無法讀取儲存庫（HTTP ${cur.status}），請確認擁有者、儲存庫名稱與權杖權限`);

  const res = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({
    message: `content: 後台更新 ${path}`, content: toBase64(json), branch, sha }) });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`發佈失敗（HTTP ${res.status}）${detail.message ? `：${detail.message}` : ''}`);
  }
}

/**
 * ctx：{ getData(), ensureSaved() → boolean, replaceData(data, message) }
 */
export function renderPublish(ctx) {
  const json = () => JSON.stringify(ctx.getData(), null, 2);
  const gh = { owner: '', repo: '', branch: 'main', path: 'data.json', token: '', ...readGh() };

  /* ---- 1. GitHub ---- */
  const ghInput = (key, label, opts = {}) => h('div', { class: 'field' + (opts.full ? ' full' : '') },
    h('label', { class: 'field-label' }, label),
    h('input', { type: opts.type || 'text', value: gh[key], placeholder: opts.placeholder || '', autocomplete: 'off',
      oninput: (e) => { gh[key] = e.target.value.trim(); } }),
    opts.help && h('small', { class: 'help' }, opts.help));

  const publishBtn = h('button', { class: 'btn primary', onclick: async () => {
    if (!gh.owner || !gh.repo || !gh.token) return toast('請先填寫擁有者、儲存庫名稱與存取權杖', 'error');
    if (!(await ctx.ensureSaved())) return;
    publishBtn.disabled = true; publishBtn.textContent = '發佈中…';
    try {
      localStorage.setItem(GH_KEY, JSON.stringify(gh));
      await githubPublish(gh, json());
      toast('已發佈到 GitHub！網站通常會在 1–2 分鐘內更新', 'success', 6000);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      publishBtn.disabled = false; publishBtn.textContent = '🚀 發佈上線';
    }
  } }, '🚀 發佈上線');

  const ghCard = h('section', { class: 'panel glass' },
    h('h3', {}, '① GitHub 一鍵發佈', h('span', { class: 'badge' }, '推薦')),
    h('p', { class: 'muted' }, '網站放在 GitHub Pages（或由 GitHub 自動部署的 Netlify / Vercel / Cloudflare Pages）時，填一次設定，之後手機或電腦都能直接按鈕發佈。'),
    h('div', { class: 'fields' },
      ghInput('owner', 'GitHub 帳號或組織', { placeholder: 'your-name' }),
      ghInput('repo', '儲存庫名稱', { placeholder: 'boardgame-site' }),
      ghInput('branch', '分支', { placeholder: 'main' }),
      ghInput('path', 'data.json 在儲存庫中的路徑', { placeholder: 'data.json' }),
      ghInput('token', '存取權杖（Fine-grained token）', { type: 'password', full: true,
        help: '只需開啟這一個儲存庫的「Contents：Read and write」權限。權杖只會存在這台裝置的瀏覽器裡，請勿在公用電腦上儲存。' })),
    h('div', { class: 'row' }, publishBtn,
      h('button', { class: 'btn ghost', onclick: () => { localStorage.removeItem(GH_KEY); toast('已清除這台裝置上的 GitHub 設定', 'info'); ctx.rerender(); } }, '清除已存的設定')));

  /* ---- 2. 直接寫入本機檔案 ---- */
  const fsSupported = 'showSaveFilePicker' in window;
  const fsCard = h('section', { class: 'panel glass' },
    h('h3', {}, '② 直接寫入電腦裡的 data.json'),
    h('p', { class: 'muted' }, fsSupported
      ? '適合在自己電腦上編輯專案資料夾：選擇專案中的 data.json，內容會直接覆寫。'
      : '這個瀏覽器不支援直接寫入檔案（需要電腦版 Chrome 或 Edge），請改用其他方式。'),
    h('button', { class: 'btn', disabled: !fsSupported, onclick: async () => {
      if (!(await ctx.ensureSaved())) return;
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: 'data.json', types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }] });
        const w = await handle.createWritable();
        await w.write(json());
        await w.close();
        toast(`已寫入 ${handle.name}`, 'success');
      } catch (err) {
        if (err.name !== 'AbortError') toast(`寫入失敗：${err.message}`, 'error');
      }
    } }, '💾 選擇 data.json 並寫入'));

  /* ---- 3. 匯出 / 匯入 ---- */
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || !parsed.site) throw new Error('這不是本網站的 data.json 格式');
      if (!(await confirmDialog('匯入後會取代目前後台的所有內容，確定要匯入嗎？', { okLabel: '匯入' }))) return;
      ctx.replaceData(withDefaults(parsed), '已匯入，確認內容後請按「儲存變更」');
    } catch (err) {
      toast(`匯入失敗：${err.message}`, 'error');
    }
  } });
  const ioCard = h('section', { class: 'panel glass' },
    h('h3', {}, '③ 下載 / 匯入備份'),
    h('p', { class: 'muted' }, '下載 data.json 後，上傳到主機覆蓋同名檔案即可更新網站；也建議定期下載一份當作備份。'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: async () => {
        if (!(await ctx.ensureSaved())) return;
        downloadText('data.json', json());
        toast('已下載 data.json', 'success');
      } }, '⬇ 下載 data.json'),
      h('button', { class: 'btn ghost', onclick: () => fileInput.click() }, '⬆ 匯入 data.json'), fileInput));

  /* ---- 還原 ---- */
  const resetCard = h('section', { class: 'panel glass' },
    h('h3', {}, '還原為線上版本'),
    h('p', { class: 'muted' }, '捨棄這台裝置上所有尚未發佈的修改，重新載入目前線上的 data.json。'),
    h('button', { class: 'btn danger', onclick: async () => {
      if (!(await confirmDialog('確定要捨棄本機草稿、還原成線上版本嗎？這個動作無法復原。', { okLabel: '還原', danger: true }))) return;
      try {
        const published = await fetchPublished();
        clearDraft();
        ctx.replaceData(published, '已還原為線上版本', true);
      } catch (err) {
        toast(`還原失敗：${err.message}`, 'error');
      }
    } }, '↺ 還原'));

  return h('div', { class: 'stack' }, ghCard, fsCard, ioCard, resetCard);
}
