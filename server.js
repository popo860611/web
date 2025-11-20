import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. API routes will fail until it is configured.');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let cachedWorlds = null;
let cachedAt = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isCacheValid() {
  if (!cachedWorlds || !cachedAt) return false;
  return Date.now() - cachedAt < CACHE_TTL_MS;
}

function cleanResponseText(text) {
  if (!text) return '';
  return text
    .trim()
    .replace(/^```json\n?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function extractTextFromResponse(response) {
  if (!response) return '';
  if (response.output_text) return response.output_text;
  if (response.output && Array.isArray(response.output)) {
    return response.output
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part.text) return part.text;
        if (part.content) return part.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function validateWorlds(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.seasons)) return false;
  return data.seasons.every((season) => {
    return (
      typeof season.year === 'number' &&
      typeof season.championTeam === 'string' &&
      season.championTeam.length > 0 &&
      typeof season.runnerUpTeam === 'string' &&
      typeof season.location === 'string' &&
      typeof season.score === 'string' &&
      Array.isArray(season.keyPlayers) &&
      Array.isArray(season.highlightVideos)
    );
  });
}

async function fetchWorldsData() {
  const prompt = `請生成英雄聯盟世界大賽圖鑑的 JSON，格式為 WorldsResponse：\n{
"lastUpdated": string, // ISO 時間字串
"seasons": WorldsSeason[]
}\n從 2011 (Season 1 World Championship) 到最新一屆，每年都要有以下欄位：year, championTeam, runnerUpTeam, location (決賽城市), score, keyPlayers (1~3 名代表性選手，包含 name、role、team、imageUrl、bio 繁體中文), highlightVideos (至少 1 支經典對局，包含 title、url)。\n請嚴格只輸出符合 WorldsResponse 結構的純 JSON，不要前後加任何解說或 Markdown。圖片網址請透過 web_search 找尋可直接使用的圖片連結，優先 Leaguepedia/LoL Fandom、Riot 官方或 Wikimedia。highlightVideos 以 YouTube 上官方或授權 VOD 為主。`;

  const response = await openai.responses.create({
    model: 'gpt-5.1',
    input: prompt,
    tools: [{ type: 'web_search' }],
  });

  const text = cleanResponseText(extractTextFromResponse(response));
  if (!text) {
    throw new Error('Empty response from OpenAI');
  }

  try {
    const parsed = JSON.parse(text);
    if (!validateWorlds(parsed)) {
      throw new Error('Validation failed for worlds data');
    }
    return parsed;
  } catch (err) {
    console.error('Failed to parse worlds data', { textSnippet: text.slice(0, 300) });
    throw err;
  }
}

app.get('/api/worlds', async (req, res) => {
  const { refresh } = req.query;
  try {
    if (refresh !== '1' && isCacheValid()) {
      return res.json(cachedWorlds);
    }

    const data = await fetchWorldsData();
    cachedWorlds = data;
    cachedAt = Date.now();
    res.json(data);
  } catch (err) {
    console.error('Error in /api/worlds', err);
    res.status(500).json({ error: '取得世界賽資料時發生錯誤，請稍後再試。' });
  }
});

app.post('/api/worlds-chat', async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'question 欄位必填。' });
  }

  const contextSummary = cachedWorlds
    ? cachedWorlds.seasons
        .map((s) => `${s.year} 冠軍：${s.championTeam}，亞軍：${s.runnerUpTeam}`)
        .join('\n')
    : '目前沒有快取資料。';

  const messages = [
    { role: 'system', content: '你是一位專門講解英雄聯盟世界賽歷史、戰術、版本、選手故事的教練，回答請用繁體中文。' },
    { role: 'user', content: `使用者問題：${question}\n若有需要，請參考以下世界賽摘要：\n${contextSummary}` },
  ];

  try {
    const response = await openai.responses.create({
      model: 'gpt-5.1-mini',
      messages,
      tools: [{ type: 'web_search' }],
    });

    const replyText = extractTextFromResponse(response).trim() || '目前無法取得解答，請稍後再試。';
    res.json({ reply: replyText });
  } catch (err) {
    console.error('Error in /api/worlds-chat', err);
    res.status(500).json({ error: '取得回應時發生錯誤，請稍後再試。' });
  }
});

app.get('*', (req, res) => {
  const filePath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send('Not found');
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
