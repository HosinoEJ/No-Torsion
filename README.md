# N·C·T

## N·C·T Project. -by: VICTIMS UNION

[![Status](https://img.shields.io/badge/Status-Active-brightgreen)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg)]()

**我們致力於記錄、曝光並抵制所有形式的「扭轉治療」機構。**  
每一份真實的聲音，都是終結傷害的力量。

- 站點首頁：https://victimsunion.org
- 匿名表單：https://victimsunion.org/form
- 公開地圖：https://victimsunion.org/map
- 原始 Google Form：https://forms.gle/eHwkmNCZtmZhLjzh7

**歷史曾用名和域名**

- NO TORSION

- https://no-torsion.hosinoneko.me
- https://nct.hosinoneko.me

> 我們承諾不以任何理由主動收集不必要的個人資訊。

---

## 項目目標

1. 打破信息壟斷，讓更多人看見相關機構與風險資訊。
2. 為受害者與知情者提供一個可匿名提交、可持續保存的經歷記錄入口。
3. 透過地圖與公開 API 讓資料更容易被查閱、分析與再利用。
4. 在必要時支持他人自行部署，降低單點失效與封鎖風險。

## 主要功能

- 匿名表單提交，支援基礎防刷、限流與審計日志。
- 機構地圖頁與公開 `GET /api/map-data` 資料接口。
- 博客 / 通知 / 文章頁面。
- 多語言界面與部分內容翻譯。
- 自動輸出 `sitemap.xml` 與 `robots.txt`。
- 可透過 GitHub + Cloudflare Workers Builds 自動部署。

## 技術棧

- Node.js 18+
- Express 5
- EJS
- Cloudflare Workers
- Google Form
- 可選 Google Apps Script 資料源

當前代碼保留兩種本地運行方式：

- 傳統 Node 啓動：`npm start`
- Workers 本地調試：`npm run dev:workers`

正式部署方式以 **GitHub + Workers Builds** 為主。

---

## Stargazers over time
[![Stargazers over time](https://starchart.cc/NO-CONVERSION-THERAPY/NCT.svg?variant=adaptive)](https://starchart.cc/NO-CONVERSION-THERAPY/NCT)



## 開發與貢獻


### 1. 取得專案

```bash
git clone https://github.com/NO-CONVERSION-THERAPY/NCT.git
cd NCT
npm install
```

### 2. 建立環境變數

建議直接從範例檔開始：

```bash
cp .env.example .env
```

然後根據你的環境修改 `.env`。

如果你要用 Workers 本地調試，建議改用 `.dev.vars`，不要和 `.env` 混用。

### 3. 本地啓動

Node 模式：

```bash
npm start
```

Workers 模式：

```bash
npm run dev:workers
```

### 4. 跑測試

```bash
npm test
```

> 提示：本地運行環境在中華人民共和國大陸地區時，表單實際提交到 Google Form 可能受到網絡環境影響。開發時建議先使用 `FORM_DRY_RUN="true"`。

---

## 配置說明

完整註釋版配置請直接查看 [.env.example](./.env.example)。

### 常用環境變數

說明：

- `必要`：正式部署建議顯式配置。
- `按需`：只在啓用對應能力時必填。
- `非必要`：留空時會使用默認值或降級行為。

| 變數 | 是否必填 | 默認值 | 用途 / 備註 |
| --- | --- | --- | --- |
| `TITLE` | 非必要 | `N·C·T` | 站點標題 |
| `DEBUG_MOD` | 非必要 | `true` | 是否開啓調試頁 |
| `FORM_DRY_RUN` | 非必要 | `true` | 是否只預覽提交、不真正送出 |
| `SITE_URL` | 非必要 | `https://www.victimsunion.org/` | 站點正式網址，用於 `sitemap.xml`、`robots.txt` 等 |
| `PORT` | 非必要 | `3000` | 本地 Node 啓動端口 |
| `PAGE_READ_RATE_LIMIT_MAX` | 非必要 | `180` | 5 分鐘內單 IP 最多頁面讀取次數，用於降低過度爬站 |
| `MAP_READ_RATE_LIMIT_MAX` | 非必要 | `60` | 5 分鐘內單 IP 最多公開地圖 API 讀取次數 |
| `SUBMIT_RATE_LIMIT_MAX` | 非必要 | `5` | 15 分鐘內單 IP 最多提交次數 |
| `FORM_PROTECTION_SECRET` | 非必要 | 自動派生 | 未配置時會根據 `FORM_ID`、`SITE_URL` 和 `TITLE` 派生一個值；正式環境建議顯式設置 |
| `FORM_PROTECTION_MIN_FILL_MS` | 非必要 | `3000` | 最短填寫時間 |
| `FORM_PROTECTION_MAX_AGE_MS` | 非必要 | `86400000` | 表單 token 最長有效期 |
| `FORM_ID` | 非必要 | `1FAIpQLScggjQgYutXQrjQDrutyxL0eLaFMktTMRKsFWPffQGavUFspA` | Google Form ID |
| `GOOGLE_SCRIPT_URL` | 非必要 | 空 | 私有 Google Apps Script 資料源；留空時回退公開資料源 |
| `PUBLIC_MAP_DATA_URL` | 非必要 | `https://nct.hosinoneko.me/api/map-data` | 公開地圖 API 地址 |
| `GOOGLE_CLOUD_TRANSLATION_API_KEY` | 按需 | 空 | Google Cloud Translation API Key；啓用翻譯功能時必填 |
| `TRANSLATION_PROVIDER_TIMEOUT_MS` | 非必要 | `10000` | 翻譯請求超時，單位毫秒 |
| `TRUST_PROXY` | 非必要 | `true` | 是否信任反向代理；Workers / 代理環境建議設為 `1` 或 `true` |
| `RATE_LIMIT_REDIS_URL` | 非必要 | 空 | 共享限流存儲；留空時退回單實例記憶體限流 |

### 翻譯服務配置

翻譯功能現在只支持 **Google Cloud Translation API**，不再保留其他翻譯 provider，也不再使用非正式公共接口。

建議：

- `GOOGLE_CLOUD_TRANSLATION_API_KEY` 屬於敏感資訊，應放在 Workers `Secret`，不要提交到 GitHub。
- Google Cloud Translation 固定使用官方地址 `https://translation.googleapis.com`，不需要單獨配置 base URL。
- `TRANSLATION_PROVIDER_TIMEOUT_MS` 控制單次翻譯請求超時，預設 `10000` 毫秒。
- 若未配置 `GOOGLE_CLOUD_TRANSLATION_API_KEY`，`/api/translate-text` 會直接返回失敗，地圖詳情與博客雙語區塊也不會顯示翻譯結果。

### 配置建議

- 本地開發：`DEBUG_MOD="true"`、`FORM_DRY_RUN="true"`。
- 正式部署：`DEBUG_MOD="false"`、`FORM_DRY_RUN="false"`。
- 若你希望公開內容可被搜索引擎正常收錄，但仍限制高頻抓取，建議保留 `PAGE_READ_RATE_LIMIT_MAX` 與 `MAP_READ_RATE_LIMIT_MAX`，並按實際流量調整。
- 翻譯功能現在只走**正式翻譯後端**，不再使用 `translate.googleapis.com` 這類非正式接口。
- 啓用翻譯時只需要配置 `GOOGLE_CLOUD_TRANSLATION_API_KEY`。
- `FORM_PROTECTION_SECRET` 屬於服務端敏感資訊，不要提交到版本庫。
- 若未配置 `GOOGLE_SCRIPT_URL`，地圖頁會退回使用 `PUBLIC_MAP_DATA_URL`。
- 若未配置 `RATE_LIMIT_REDIS_URL`，限流會退回單實例記憶體模式。

### 翻譯服務示例

Google Cloud Translation：

```bash
GOOGLE_CLOUD_TRANSLATION_API_KEY="替換成你的 Google Cloud API Key"
TRANSLATION_PROVIDER_TIMEOUT_MS="10000"
```

---

## 部署到 Cloudflare Workers

倉庫根目錄已包含：

- [worker.mjs](./worker.mjs)：Workers 入口
- [wrangler.jsonc](./wrangler.jsonc)：Workers 配置

這兩個文件會把 `views/`、`blog/`、`public/`、`data.json`、`friends.json` 一併打包進 Workers 的 `/bundle`。

`wrangler.jsonc` 目前只保留必須寫死到倉庫裡的 `RUNTIME_TARGET="workers"`。
其他環境變數不建議直接寫進 `wrangler.jsonc`，而是放到：

- Cloudflare Dashboard 的 `Variables and Secrets`
- 本地 Workers 調試使用的 `.dev.vars`

### 0. 前置條件

你需要準備：

- 一個 Cloudflare 帳號
- 一個 GitHub 倉庫
- Node.js 18+
- 已提交並推送的專案代碼

如果你要綁定正式域名，還需要：

- 網域已接入 Cloudflare
- 你對該 zone 擁有管理權限

### 1. 先做本地驗證

部署前建議先在本地驗證 Workers 版本：

```bash
npm install
npm run dev:workers
npm test
```

Workers 本地開發時，建議把變數放進 `.dev.vars`。最小示例：

```bash
SITE_URL="http://127.0.0.1:8787"
PAGE_READ_RATE_LIMIT_MAX="180"
MAP_READ_RATE_LIMIT_MAX="60"
```

如果你還想在本地測翻譯功能，再額外加上：

```bash
GOOGLE_CLOUD_TRANSLATION_API_KEY="換成你自己的正式 API Key"
```

### 2. 連接 GitHub 倉庫

1. 將本專案推送到 GitHub。
2. 打開 Cloudflare Dashboard。
3. 進入 **Workers & Pages**。
4. 點擊 **Create application**。
5. 在 **Import a repository** 旁選擇 **Get started**。
6. 授權 **Cloudflare Workers & Pages** GitHub App。
7. 選擇本專案所在的倉庫。

### 3. 配置 Workers Builds

推薦配置：

| 項目 | 建議值 |
| --- | --- |
| `Git branch` | `main` |
| `Root directory` | `.` |
| `Build command` | 留空 |
| `Deploy command` | `npm run deploy:workers` |
| `Non-production branch deploy command` | 保持預設 `npx wrangler versions upload` |

完成後點擊 **Save and Deploy**。

#### Branch 切換注意事項

- Workers Builds 初次建立專案時，通常會先跟隨 **GitHub 倉庫的默認分支**。如果你的 GitHub 默認分支還是 `main`，首次建立頁面裡看到 `main` 屬於正常現象。
- 如果你之後想把正式部署分支改成別的分支，例如 `backendmodifi`，請到：
  `Workers & Pages` -> 你的 Worker -> `Settings` -> `Build` -> `Branch control`
- 在 `Branch control` 裡修改 `Production branch` 後，**只會影響之後的新提交**，不會把當前已上線版本立刻切到新分支。
- 改完 `Production branch` 並點 `Save` 之後，請再向目標分支 **push 一次新 commit**，讓 Cloudflare 重新觸發正式部署。
- 如果 Cloudflare 介面裡看起來還顯示舊分支，常見原因不是設定失敗，而是當前活動部署仍然是舊分支產生的版本。
- 切換前請確認目標分支已經真實推送到 GitHub，不要只有本地存在。
- `Builds for non-production branches`：
  - 開啓後，非正式分支也會自動產生預覽構建。
  - 關閉後，只有 `Production branch` 會自動部署。
- 如果你希望 `main` 做正式環境、`dev` 或其他分支只做預覽，保留 `Builds for non-production branches` 即可；如果你希望別的分支成為正式環境，就必須在 `Branch control` 中把 `Production branch` 改過去。

### 4. 補齊 Variables 和 Secrets

第一次部署完成後，請到：

`Workers & Pages` -> 你的 Worker -> `Settings` -> `Variables and Secrets`

建議配置以下值：

| 名稱 | 類型 | 建議 |
| --- | --- | --- |
| `TITLE` | Text | `N·C·T` |
| `DEBUG_MOD` | Text | 正式環境填 `false` |
| `FORM_DRY_RUN` | Text | 正式環境填 `false` |
| `SITE_URL` | Text | 你的正式網址 |
| `PAGE_READ_RATE_LIMIT_MAX` | Text | 視站點流量調整；預設 `180` |
| `MAP_READ_RATE_LIMIT_MAX` | Text | 視 API 開放程度調整；預設 `60` |
| `SUBMIT_RATE_LIMIT_MAX` | Text | 視提交入口風險調整；預設 `5` |
| `FORM_ID` | Text | 你的 Google Form ID |
| `FORM_PROTECTION_SECRET` | Secret | 正式環境強烈建議顯式配置 |
| `FORM_PROTECTION_MIN_FILL_MS` | Text | 預設 `3000` |
| `FORM_PROTECTION_MAX_AGE_MS` | Text | 預設 `86400000` |
| `GOOGLE_SCRIPT_URL` | Text 或 Secret | 有私有資料源時填 |
| `PUBLIC_MAP_DATA_URL` | Text | 沒有私有資料源時配置成你的公開地圖 API |
| `GOOGLE_CLOUD_TRANSLATION_API_KEY` | Secret | 啓用翻譯功能時必填 |
| `TRANSLATION_PROVIDER_TIMEOUT_MS` | Text | 預設 `10000` |
| `TRUST_PROXY` | Text | Workers / 代理環境建議 `1` 或 `true` |
| `RATE_LIMIT_REDIS_URL` | Secret | 多實例部署建議配置共享限流存儲 |

補完變數後，重新觸發一次部署。

### 5. 名稱一致性

如果你是先在 Cloudflare 裡建立 Worker，再去接 GitHub 倉庫，請確保：

- Dashboard 中的 Worker 名稱
- [wrangler.jsonc](./wrangler.jsonc) 裡的 `name`

兩者完全一致，否則 Builds 會失敗。

目前本專案的 Worker 名稱為：

```text
no-torsion
```

### 6. 綁定正式域名

如果你不想使用 `*.workers.dev`，可以綁定自己的 Cloudflare 網域：

1. 進入 **Workers & Pages**
2. 選擇你的 Worker
3. 打開 **Settings > Domains & Routes**
4. 點 **Add > Custom Domain**
5. 輸入你的網域或子網域，例如：
   - `nct.example.com`
   - `example.com`
6. 點 **Add Custom Domain**

綁定成功後，記得同步更新：

- `SITE_URL`
- `PUBLIC_MAP_DATA_URL`

### 7. 上線後檢查清單

正式部署完成後，建議至少手動驗證以下路徑：

- `/`
- `/map`
- `/form`
- `/blog`
- `/api/map-data`
- `/sitemap.xml`
- `/robots.txt`

如果 `FORM_DRY_RUN="false"`，也要實測表單是否能成功送到 Google Form。

### 8. Workers 上的已知差異

- 模板、博客 Markdown 與 JSON 檔案會從 Workers 的 `/bundle` 讀取。
- 翻譯服務已移除 `curl` 子進程兜底，現在固定使用 Google Cloud Translation API。
- `sitemap.xml` 在 Workers 上會優先使用文章元資料中的 `CreationDate` 作為 `lastmod`。
- 若未配置共享 Redis，限流會退回單實例記憶體模式，跨實例一致性較弱。

### 9. 常見問題

**Q: 本地 `npm start` 和 Workers 版本會衝突嗎？**  
A: 不會。兩者只是不同的本地運行入口。

**Q: 這個專案要不要額外跑前端 build？**  
A: 目前不需要。Workers Builds 的 `Build command` 一般留空即可。

**Q: 為什麼 `Deploy command` 用的是 `npm run deploy:workers`？**  
A: 因為它會呼叫 `npx wrangler deploy`，且與本倉庫的 `package.json` 保持一致。

---

## 公開 API

### `GET /api/map-data`

公開接口：

```text
https://nct.hosinoeiji.workers.dev/api/map-data
```

如果你是自行部署，則改用你自己的域名，例如：

```text
https://你的網域/api/map-data
```

返回值示例：

```json
{
  "avg_age": 17,
  "last_synced": 1774925078387,
  "statistics": [
    { "province": "河南", "count": 12 },
    { "province": "湖北", "count": 66 }
  ],
  "data": [
    {
      "name": "學校名稱",
      "addr": "學校地址",
      "province": "省份",
      "prov": "區、縣",
      "else": "其他補充内容",
      "lat": 36.62728,
      "lng": 118.58882,
      "experience": "經歷描述",
      "HMaster": "負責人/校長姓名",
      "scandal": "已知醜聞",
      "contact": "學校聯繫方式",
      "inputType": "受害者本人"
    }
  ]
}
```

字段說明：

- `lat` / `lng`：經緯度
- `last_synced`：毫秒級 Unix timestamp
- 真正的機構列表位於 `data` 欄位

### 最簡單的調用示例

```html
<script>
  fetch('https://nct.hosinoeiji.workers.dev/api/map-data')
    .then((res) => res.json())
    .then((payload) => {
      console.log(payload.data);
    });
</script>
```

如果你想把資料做成地圖，可直接配合 [Leaflet](https://leafletjs.com) 等前端地圖庫使用；本專案自己的 `/map` 頁面就是一個完整示例。

---

## 貢獻

歡迎提交 issue、PR 或 fork 自行部署。

在提交前建議至少確認：

```bash
npm test
```

若你是針對部署、環境變數或表單流程做修改，也建議一併驗證：

- `/form`
- `/submit`
- `/api/map-data`
- `/blog`

---

## 授權

本專案授權資訊請參見 [LICENSE](./LICENSE)。
