const yearSelect = document.getElementById('yearSelect');
const seasonList = document.getElementById('seasonList');
const playerGrid = document.getElementById('playerGrid');
const playerSearch = document.getElementById('playerSearch');
const videoList = document.getElementById('videoList');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdatedEl = document.getElementById('lastUpdated');
const statusBadge = document.getElementById('statusBadge');
const chatLog = document.getElementById('chatLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

let worldsData = null;
let currentYear = null;
let isLoading = false;

function setStatus(message, state = 'idle') {
  statusBadge.textContent = message;
  statusBadge.dataset.state = state;
}

function getEmbedUrl(url) {
  try {
    const ytMatch = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
    if (ytMatch) {
      return `https://www.youtube.com/embed/${ytMatch[1]}`;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function renderSeasons() {
  if (!worldsData) return;
  const seasons = [...worldsData.seasons].sort((a, b) => b.year - a.year);

  yearSelect.innerHTML = seasons
    .map((s) => `<option value="${s.year}">${s.year} 年 - ${s.championTeam}</option>`)
    .join('');

  seasonList.innerHTML = seasons
    .map(
      (s) => `
        <li>
          <strong>${s.year} 年</strong>｜冠軍：${s.championTeam}｜比分：${s.score}｜亞軍：${s.runnerUpTeam}
        </li>`
    )
    .join('');

  currentYear = seasons[0]?.year || null;
  yearSelect.value = currentYear;
  renderPlayers();
  renderVideos();
  updateLastUpdated();
}

function renderPlayers() {
  if (!worldsData || !currentYear) return;
  const season = worldsData.seasons.find((s) => s.year === Number(currentYear));
  if (!season) return;

  const query = playerSearch.value.trim().toLowerCase();
  const players = season.keyPlayers.filter((p) => p.name.toLowerCase().includes(query));

  if (!players.length) {
    playerGrid.innerHTML = '<div class="empty">找不到符合條件的選手</div>';
    return;
  }

  playerGrid.innerHTML = players
    .map((p) => {
      const safeImg = p.imageUrl || 'placeholder-player.svg';
      return `
        <div class="card">
          <img src="${safeImg}" alt="${p.name}" onerror="this.onerror=null;this.src='placeholder-player.svg';" />
          <div>
            <h3>${p.name}｜${p.role}</h3>
            <div class="meta">${season.year} 年 - ${p.team}</div>
            <p>${p.bio}</p>
          </div>
        </div>`;
    })
    .join('');
}

function renderVideos() {
  if (!worldsData || !currentYear) return;
  const season = worldsData.seasons.find((s) => s.year === Number(currentYear));
  if (!season) return;

  if (!season.highlightVideos?.length) {
    videoList.innerHTML = '<li class="empty">目前沒有可觀看的影片</li>';
    return;
  }

  videoList.innerHTML = season.highlightVideos
    .map((v) => {
      const embedUrl = getEmbedUrl(v.url);
      const safeTitle = `${season.year}｜${v.title}`;
      const link = `<a href="${v.url}" target="_blank" rel="noopener noreferrer">${safeTitle}</a>`;
      const embed = embedUrl
        ? `<div class="video-embed"><iframe src="${embedUrl}" title="${safeTitle}" allowfullscreen loading="lazy"></iframe></div>`
        : '';
      return `<li>${link}${embed}</li>`;
    })
    .join('');
}

function updateLastUpdated() {
  if (!worldsData?.lastUpdated) return;
  const date = new Date(worldsData.lastUpdated);
  lastUpdatedEl.textContent = `最後更新：${date.toLocaleString('zh-TW')}`;
}

async function fetchWorlds(refresh = false) {
  try {
    isLoading = true;
    setStatus(refresh ? '重新整理中，可能需要一點時間...' : '資料載入中...', 'loading');
    refreshBtn.disabled = true;
    refreshBtn.textContent = '更新中...';
    const url = refresh ? '/api/worlds?refresh=1' : '/api/worlds';
    const res = await fetch(url);
    if (!res.ok) throw new Error('無法取得世界賽資料');
    const data = await res.json();
    worldsData = data;
    renderSeasons();
    setStatus('載入完成，可切換年份或搜尋選手', 'success');
  } catch (err) {
    console.error(err);
    alert('取得世界賽資料失敗，請稍後再試。');
    setStatus('取得資料失敗，稍後再試', 'error');
  } finally {
    isLoading = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = '重新從 GPT 更新資料';
  }
}

function appendChatMessage(text, role = 'assistant', replaceLast = false) {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${role}`;
  msg.textContent = text;
  if (replaceLast && chatLog.lastChild) {
    chatLog.lastChild.replaceWith(msg);
  } else {
    chatLog.appendChild(msg);
  }
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function submitQuestion(question) {
  appendChatMessage(question, 'user');
  appendChatMessage('思考中...', 'assistant');
  try {
    const res = await fetch('/api/worlds-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) throw new Error('回應失敗');
    const data = await res.json();
    appendChatMessage(data.reply || '沒有取得回應', 'assistant', true);
  } catch (err) {
    console.error(err);
    appendChatMessage('取得回應失敗，請確認網路後再試一次。', 'assistant', true);
  }
}

refreshBtn.addEventListener('click', () => fetchWorlds(true));
yearSelect.addEventListener('change', (e) => {
  currentYear = Number(e.target.value);
  renderPlayers();
  renderVideos();
});

playerSearch.addEventListener('input', () => renderPlayers());

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const question = chatInput.value.trim();
  if (!question) return;
  chatInput.value = '';
  submitQuestion(question);
});

fetchWorlds();
