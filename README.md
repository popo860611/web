# 英雄聯盟世界賽圖鑑 (LoL Worlds Atlas)

本專案提供一個最小可執行的前後端範例：
- 前端：單頁靜態網頁（原生 HTML/CSS/JS），透過 REST API 取得世界賽資料與聊天回應。
- 後端：Node.js + Express，使用 OpenAI Responses API + web_search 產生資料並提供快取。

## 環境需求
- Node.js 18+（需支援 ES Modules）
- 已設定環境變數 `OPENAI_API_KEY`

## 安裝與啟動
1. 安裝依賴
   ```bash
   npm install
   ```
2. 設定 OpenAI API Key
   - 透過環境變數：
     ```bash
     export OPENAI_API_KEY=你的_API_key
     ```
   - 或建立 `.env` 檔（可複製 `.env.example` 後修改）：
     ```bash
     cp .env.example .env
     # 編輯 .env，將 OPENAI_API_KEY 填入你自己的金鑰
     ```

3. 啟動伺服器
   ```bash
   npm start
   ```
4. 使用者存取入口
   - 本機：開啟瀏覽器造訪 <http://localhost:3000>
   - 同區網其他裝置：以啟動主機的 IP 取代 localhost，例如 <http://192.168.0.10:3000>

## 主要 API
- `GET /api/worlds`：取得快取的世界賽資料；`?refresh=1` 會強制重新向 GPT + web_search 取回最新內容並更新快取。
- `POST /api/worlds-chat`：世界賽解說助手。Request body: `{ "question": "你的問題" }`

## 架構說明
- `server.js`：Express 伺服器、OpenAI 呼叫、快取與 API 路由。
- `public/`：前端靜態資源（`index.html`, `style.css`, `app.js`）。

## 注意事項
- API 金鑰只會在後端使用，前端不會暴露。
- 切勿將實際的 `OPENAI_API_KEY` 提交到版本控制；請使用 `.env` 檔或系統環境變數設定。
- 重啟伺服器會清除記憶體快取。
