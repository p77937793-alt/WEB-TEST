# 沈浸式桌遊互動網站 + 後台管理系統

一個**不需要伺服器、不需要資料庫**的資料驅動網站：前台所有內容都來自 `data.json`，
後台（`admin.html`）提供表單介面讓你新增、修改、刪除內容，完全不用碰程式碼。

---

## 一、架構與資料流藍圖

```
                ┌──────────────────────── 你的瀏覽器 ────────────────────────┐
                │                                                            │
  admin.html ── 編輯表單 ──▶ 按「儲存變更」──▶ 驗證 ──▶ localStorage 草稿       │
  （後台）                                                │                   │
                                                          │ storage 事件（即時）│
                                                          ▼                   │
  index.html ◀── 自動重新渲染 ◀── store.js 讀取「草稿 or data.json」            │
  （前台）                                                                     │
                └────────────────────────────────────────────────────────────┘
                                         │ 按「發佈上線」
                                         ▼
                        主機上的 data.json（GitHub / 任何靜態主機）
                                         │
                                         ▼
                          所有訪客的 index.html 讀到新內容
```

| 階段 | 發生什麼事 | 誰看得到 |
|---|---|---|
| **編輯** | 表單直接修改記憶體中的資料物件 | 只有後台畫面 |
| **儲存** | 通過驗證後寫入瀏覽器的 localStorage（草稿） | 你這台裝置的前台（開著的分頁會立刻同步） |
| **發佈** | 把草稿寫成主機上的 `data.json` | 所有訪客 |

讀取規則（`js/core/store.js`）：草稿存在且不比 `data.json` 舊 → 顯示草稿；否則顯示 `data.json`。
訪客沒有草稿，所以永遠看到已發佈的版本。前台顯示草稿時，左下角會出現黃色「正在預覽本機草稿」提示。

### 檔案結構

```
index.html            前台入口（空殼，內容全由 JS 依資料產生）
admin.html            後台入口
data.json             ★ 網站所有內容
css/
  base.css            共用：色彩變數、按鈕、Toast、對話框、雷達圖
  front.css           前台樣式
  admin.css           後台樣式
js/
  core/store.js       資料層：讀 data.json、讀寫草稿、同步
  core/utils.js       DOM 建立、Toast、確認對話框、網址過濾
  core/radar.js       SVG 雷達圖
  front/app.js        前台各區塊的渲染
  front/games.js      三種小遊戲引擎（問答 / 翻牌 / 擲骰）
  admin/app.js        後台外框、儲存、三大模組畫面
  admin/forms.js      通用表單引擎（欄位定義 → 表單 + 驗證）
  admin/schemas.js    ★ 後台「有哪些欄位可編輯」的定義
  admin/publish.js    發佈、匯出匯入、還原
assets/uploads/       放圖片檔的地方（選用）
```

### data.json 結構速覽

```jsonc
{
  "meta":  { "version": 1, "updatedAt": "ISO 時間（儲存時自動更新）" },
  "site":  {                       // 模組 A：全域內容
    "brand": { "name", "logoEmoji", "logoImage" },
    "theme": { "accent", "accent2" },
    "nav":   [{ "id", "label", "target", "url" }],
    "hero":  { "eyebrow", "title", "subtitle", "ctaLabel", "ctaTarget", "cta2Label", "cta2Target", "image" },
    "announcements": [{ "id", "tag", "text", "date", "active" }],
    "features":      [{ "id", "icon", "title", "text", "size": "normal|wide|tall|large" }],
    "sections": { "gamesTitle", "libraryTitle", ... },
    "contact":  { "title", "intro", "email", "phone", "address", "hours", "socials": [{ "label", "url" }] },
    "footer":   { "text" }
  },
  "games": [{                      // 模組 B：小遊戲
    "id", "type": "quiz|memory|dice", "title", "icon", "summary", "enabled", "rules": ["..."],
    "difficulties": [{ "id", "label", ...依類型不同的關卡參數 }],
    "scoring": { ...依類型不同的計分規則 },
    "questions": [{ "q", "options": ["..."], "answer": 0, "explain" }],   // 僅 quiz
    "symbols": ["🎲", "..."]                                              // 僅 memory
  }],
  "radarAxes":  [{ "key", "label" }],   // 雷達圖有哪些面向
  "boardgames": [{                 // 模組 C：桌遊百科
    "id", "name", "nameEn", "emoji", "image", "tagline", "description", "mechanics": ["..."],
    "playersMin", "playersMax", "timeMin", "timeMax", "featured",
    "ratings": { "<axis key>": 0-10 }, "pitfalls": ["..."], "tips": ["..."]
  }]
}
```

完整範例請直接看專案裡的 `data.json`。

---

## 二、白話操作指南

### 怎麼開啟後台？

網址後面加上 `admin.html`，例如 `https://你的網域/admin.html`。前台頁尾也有「後台管理」連結。

### 怎麼修改內容？

1. **編輯**：左側選單選模組
   - 🌐 **全域內容**：品牌與主題色、導覽列、首頁標語、公告、特色卡片、各區塊標題、聯絡資訊、頁尾
   - 🎮 **小遊戲**：規則說明、難易度與關卡參數、計分規則、題庫／翻牌圖案；可新增、複製、排序、上下架
   - 📚 **桌遊百科**：名稱、機制標籤、人數時間、雷達圖評分（拖滑桿即時預覽）、新手陷阱、進階心法、封面圖片
2. **儲存**：按右上角「儲存變更」（或 `Ctrl/⌘ + S`）。
   - 成功 → 右下角綠色提示；另一個分頁開著前台的話，會立刻看到新內容。
   - 有欄位沒填好 → 紅色提示，並自動跳到第一個有問題的欄位。
3. **發佈**：到「🚀 發佈與備份」選一種方式（見下方）。**沒發佈之前，訪客看到的還是舊內容。**

### 圖片怎麼放？

- **上傳**：按「⬆ 上傳圖片」。圖片會自動縮小壓縮並存進資料裡，最省事。適合少量圖片。
- **填路徑**：把圖檔放進 `assets/uploads/` 一起上傳到主機，欄位填 `assets/uploads/檔名.jpg`。圖片多的時候建議用這種方式。

> 瀏覽器草稿空間約 5 MB。上傳的圖片太多時儲存會失敗並提示你，這時請改用「填路徑」。

### 三種發佈方式

| 方式 | 適合誰 | 做法 |
|---|---|---|
| ① GitHub 一鍵發佈（推薦） | 想用手機、任何電腦隨時更新 | 填一次 GitHub 設定，之後按「🚀 發佈上線」 |
| ② 直接寫入檔案 | 在自己電腦上維護專案資料夾 | 按鈕選擇專案裡的 `data.json` 覆寫（需電腦版 Chrome / Edge） |
| ③ 下載 data.json | 用 FTP 或其他主機 | 下載後上傳到主機，覆蓋同名檔案 |

---

## 三、部署上線

這是純靜態網站，把整個資料夾放到任何靜態主機即可。

### 推薦：GitHub Pages（免費，且能搭配一鍵發佈）

1. 在 GitHub 建立一個儲存庫，把本資料夾所有檔案上傳。
2. 儲存庫 **Settings → Pages → Source** 選 `Deploy from a branch`，分支選 `main`、資料夾選 `/ (root)`。
3. 一兩分鐘後網站會出現在 `https://你的帳號.github.io/儲存庫名稱/`。
4. 建立後台用的存取權杖：GitHub 頭像 → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - Repository access：**Only select repositories** → 選這個儲存庫
   - Permissions → Repository permissions → **Contents：Read and write**
5. 開啟 `你的網站/admin.html` →「發佈與備份」→ 填入帳號、儲存庫名稱、分支（`main`）、路徑（`data.json`）與權杖。

之後的流程就是：**編輯 → 儲存 → 發佈上線**，約 1–2 分鐘後訪客就會看到。

Netlify、Vercel、Cloudflare Pages 也可以：把它們連到同一個 GitHub 儲存庫，一鍵發佈後會自動重新部署。

### 在自己電腦上預覽

瀏覽器不允許直接雙擊 `index.html` 讀取 `data.json`，需要一個本機伺服器。在專案資料夾執行：

```bash
python3 -m http.server 8000
```

然後開啟 `http://localhost:8000`（前台）與 `http://localhost:8000/admin.html`（後台）。

---

## 四、安全性須知（請務必閱讀）

- **後台頁面本身沒有登入密碼。** 靜態網站無法做到真正安全的密碼驗證（寫在前端的密碼任何人都看得到）。
  任何人都能打開 `admin.html` 並在*自己的瀏覽器*裡亂改，但那只影響他自己看到的畫面。
- **真正的保護是 GitHub 權杖。** 沒有權杖就無法修改線上的 `data.json`。
  - 權杖只存在你填寫的那台裝置的瀏覽器裡，不會寫進 `data.json` 或程式碼。
  - 不要在公用電腦上儲存；用完可按「清除已存的設定」。
  - 權杖請只開放單一儲存庫的 Contents 權限，並設定到期日。
- 後台輸入的所有文字在前台都以純文字顯示，連結也會過濾危險的網址類型。
- 若未來需要多人帳號、權限分級或操作紀錄，就需要真正的後端（例如 Supabase / Firebase），屆時只需替換 `js/core/store.js` 的讀寫函式。

---

## 五、進階：想新增可編輯欄位

1. 在 `js/admin/schemas.js` 對應的陣列加一行，例如替桌遊加「出版年份」：
   ```js
   { key: 'year', label: '出版年份', type: 'number', min: 1900, max: 2100 },
   ```
   後台就會自動出現這個欄位（含驗證）。
2. 在 `js/front/app.js` 想顯示的位置用 `b.year` 取值即可。

支援的欄位類型：`text`、`email`、`url`、`textarea`、`number`、`color`、`toggle`、`select`、`image`、`tags`、`lines`、`ratings`、`group`、`repeater`。

要新增第四種小遊戲類型：在 `js/front/games.js` 的 `ENGINES` 與 `GAME_TYPES` 各加一項，再到 `schemas.js` 的 `GAME_BY_TYPE` 定義它的參數欄位。
