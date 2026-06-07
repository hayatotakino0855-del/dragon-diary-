// js/google_api.js

const CLIENT_ID = '697558865911-7gq117lv1aahob57274uqn6632b7mt0o.apps.googleusercontent.com';
const API_KEY = 'AIzaSyCFxBA1Js6lyG81GfsKy1OtdugLmr3dEZc';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let isAuthorized = false;

// ==========================================
// 1. GAPI / GIS 初期化
// ==========================================
window.gapiLoaded = function() {
  gapi.load('client', initializeGapiClient);
};

async function initializeGapiClient() {
  try {
    await gapi.client.init({
      apiKey: API_KEY,
      discoveryDocs: DISCOVERY_DOCS,
    });
    gapiInited = true;
    maybeEnableButtons();
  } catch (err) {
    console.error('GAPI Init Error:', err);
    const authBtn = document.getElementById('googleAuthButton');
    if (authBtn) {
      authBtn.textContent = '読込失敗(再読込推奨)';
      authBtn.disabled = true;
    }
  }
}

window.gisLoaded = function() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse.error !== undefined) {
        throw (tokenResponse);
      }
      // トークンを保存（有効期限も保存）
      localStorage.setItem('hasLoggedInBefore', 'true');
      localStorage.setItem('gapi_access_token', tokenResponse.access_token);
      localStorage.setItem('gapi_token_expires_at', Date.now() + tokenResponse.expires_in * 1000);
      
      isAuthorized = true;
      updateAuthStatus();
      fetchDiariesFromCalendar();
    },
  });
  gisInited = true;
  maybeEnableButtons();
};

function maybeEnableButtons() {
  if (gapiInited && gisInited) {
    // 保存されているトークンがあれば復元
    const savedToken = localStorage.getItem('gapi_access_token');
    const expiresAt = localStorage.getItem('gapi_token_expires_at');
    if (savedToken && expiresAt && Date.now() < parseInt(expiresAt)) {
      gapi.client.setToken({ access_token: savedToken });
      isAuthorized = true;
      updateAuthStatus();
      fetchDiariesFromCalendar();
      return; // すでに認証済みの場合はボタンの初期化をスキップ
    }

    const authBtn = document.getElementById('googleAuthButton');
    if (authBtn) {
      authBtn.disabled = false;
      authBtn.textContent = 'Googleでログイン';
    }

    // --- 全自動再認証システム ---
    if (localStorage.getItem('hasLoggedInBefore') === 'true') {
      document.body.addEventListener('click', (e) => {
        // 保存ボタン等は各々の処理で再認証するためスキップ
        if (e.target.closest('#writeSubmitBtn') || e.target.closest('#detailSaveBtn')) return;
        
        const exp = localStorage.getItem('gapi_token_expires_at');
        if (!isAuthorized || !exp || Date.now() > parseInt(exp)) {
          tokenClient.callback = (resp) => {
            if (resp.error !== undefined) return;
            localStorage.setItem('gapi_access_token', resp.access_token);
            localStorage.setItem('gapi_token_expires_at', Date.now() + resp.expires_in * 1000);
            gapi.client.setToken({ access_token: resp.access_token });
            isAuthorized = true;
            updateAuthStatus();
            fetchDiariesFromCalendar();
          };
          tokenClient.requestAccessToken({prompt: ''});
        }
      }, { once: true, capture: true });
    }
  }
}

function handleAuthClick() {
  if (gapi.client.getToken() === null) {
    tokenClient.requestAccessToken({prompt: 'consent'});
  } else {
    tokenClient.requestAccessToken({prompt: ''});
  }
}

function updateAuthStatus() {
  const statusSpan = document.getElementById('googleAuthStatus');
  const authBtn = document.getElementById('googleAuthButton');
  if (isAuthorized) {
    if (statusSpan) {
      statusSpan.textContent = '連携済み (同期ON)';
      statusSpan.style.color = 'var(--accent-cyan)';
    }
    if (authBtn) {
      authBtn.textContent = 'カレンダーから同期';
      authBtn.onclick = fetchDiariesFromCalendar;
    }
  }
}

// ==========================================
// 2. タグシステム（localStorage）
// ==========================================
function getTags() {
  return JSON.parse(localStorage.getItem('diaryTags') || '[]');
}
function saveTags(tags) {
  localStorage.setItem('diaryTags', JSON.stringify(tags));
}
function getTagAssignments() {
  return JSON.parse(localStorage.getItem('diaryTagAssignments') || '{}');
}
function saveTagAssignments(assignments) {
  localStorage.setItem('diaryTagAssignments', JSON.stringify(assignments));
}

function initTagManagement() {
  const createBtn = document.getElementById('tagCreateBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      const nameInput = document.getElementById('tagNameInput');
      const colorInput = document.getElementById('tagColorInput');
      const name = nameInput.value.trim();
      if (!name) return;
      const tags = getTags();
      if (tags.find(t => t.name === name)) {
        alert('同じ名前のタグが既にあります');
        return;
      }
      tags.push({ name, color: colorInput.value });
      saveTags(tags);
      nameInput.value = '';
      renderTagList();
      renderTagFilters();
      renderWriteTags();
    });
  }
  renderTagList();
}

function renderTagList() {
  const container = document.getElementById('tagList');
  if (!container) return;
  container.innerHTML = '';
  const tags = getTags();
  tags.forEach(tag => {
    const el = document.createElement('div');
    el.className = 'tag-item';
    el.style.background = tag.color + '33';
    el.style.color = tag.color;
    el.innerHTML = `${tag.name} <button class="tag-delete-btn" data-tag="${tag.name}">✕</button>`;
    container.appendChild(el);
  });
  container.querySelectorAll('.tag-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.tag;
      let tags = getTags();
      tags = tags.filter(t => t.name !== name);
      saveTags(tags);
      // 紐付けからも削除
      const assignments = getTagAssignments();
      Object.keys(assignments).forEach(k => {
        assignments[k] = assignments[k].filter(t => t !== name);
      });
      saveTagAssignments(assignments);
      renderTagList();
      renderTagFilters();
      renderWriteTags();
      renderCurrentPage();
    });
  });
}

// ==========================================
// 3. ドライブへのアップロード
// ==========================================
async function getOrCreateFolder(folderName) {
  const response = await gapi.client.drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive'
  });
  if (response.result.files.length > 0) {
    return response.result.files[0].id;
  }
  const createResponse = await gapi.client.drive.files.create({
    resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });
  return createResponse.result.id;
}

async function uploadPhotoToDrive(file, folderId) {
  const metadata = { name: file.name, parents: [folderId] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);
  const token = gapi.client.getToken().access_token;
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  });
  const data = await response.json();
  return data.webViewLink;
}

// ==========================================
// 4. カレンダー取得・保存 + 検索・ページネーション
// ==========================================
let allDiaries = [];
let filteredDiaries = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let activeTagFilter = null;

window.getVirtualTodayStr = function() {
  const now = new Date();
  if (now.getHours() < 8) {
    now.setDate(now.getDate() - 1);
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

async function fetchDiariesFromCalendar() {
  if (!isAuthorized) return;
  const authBtn = document.getElementById('googleAuthButton');
  if (authBtn) { authBtn.textContent = '同期中...'; authBtn.disabled = true; }

  try {
    let allEvents = [];
    let pageToken = null;
    do {
      const params = {
        calendarId: 'primary',
        timeMin: (new Date(2000, 0, 1)).toISOString(),
        timeMax: (new Date()).toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500
      };
      if (pageToken) params.pageToken = pageToken;
      const response = await gapi.client.calendar.events.list(params);
      allEvents = allEvents.concat(response.result.items || []);
      pageToken = response.result.nextPageToken;
    } while (pageToken);

    allDiaries = allEvents.filter(e => e.start && e.start.date);
    allDiaries.sort((a, b) => new Date(b.start.date) - new Date(a.start.date));
    window.allDiaries = allDiaries; // グローバルからアクセスできるように追加

    applyFilters();
    renderCalendar();
    checkAchievements();
    syncPlayerStats();

    if (authBtn) {
      authBtn.textContent = `同期完了 (${allDiaries.length}件)`;
      authBtn.disabled = false;
      authBtn.onclick = fetchDiariesFromCalendar;
    }
  } catch (err) {
    console.error('Fetch Diaries Error:', err);
    if (authBtn) { authBtn.textContent = 'カレンダーから同期'; authBtn.disabled = false; }
  }
}

let lastSyncedExp = 0;

function calculateStreak() {
  if (!window.allDiaries || window.allDiaries.length === 0) return 0;
  
  const uniqueDates = new Set();
  window.allDiaries.forEach(d => {
    if (d.start && d.start.date) {
      uniqueDates.add(d.start.date);
    }
  });
  
  const dateObjs = Array.from(uniqueDates).map(ds => {
    const [y, m, d] = ds.split('-');
    return new Date(y, m - 1, d);
  }).sort((a, b) => b - a);

  let streak = 0;
  if (dateObjs.length > 0) {
    const todayStr = window.getVirtualTodayStr();
    const [ty, tm, td] = todayStr.split('-');
    const virtualToday = new Date(ty, tm - 1, td);
    virtualToday.setHours(0,0,0,0);
    
    const juneFirst = new Date(2026, 5, 1).getTime();
    const diffDays = Math.floor((virtualToday - dateObjs[0]) / 86400000);
    
    if (diffDays <= 1 && dateObjs[0].getTime() >= juneFirst) {
      streak = 1;
      let prevDate = dateObjs[0];
      for (let i = 1; i < dateObjs.length; i++) {
        if (dateObjs[i].getTime() < juneFirst) break;
        
        const diff = Math.floor((prevDate - dateObjs[i]) / 86400000);
        if (diff === 1) {
          streak++;
          prevDate = dateObjs[i];
        } else if (diff === 0) {
          continue;
        } else {
          break;
        }
      }
    }
  }
  return streak;
}

function syncPlayerStats() {
  const totalDiaries = allDiaries.length;
  const uniqueDates = new Set();
  
  allDiaries.forEach(d => {
    if (d.start && d.start.date) {
      uniqueDates.add(d.start.date);
    }
  });
  
  const totalDays = uniqueDates.size;
  // EXPはローカルで管理するため、カレンダー件数からの算出は行わない
  const dateObjs = Array.from(uniqueDates).map(ds => {
    const [y, m, d] = ds.split('-');
    return new Date(y, m - 1, d);
  }).sort((a, b) => b - a);
  
  let streak = calculateStreak();

  // 最終活動日
  let lastLoginStr = '-';
  if (dateObjs.length > 0) {
    lastLoginStr = `${dateObjs[0].getFullYear()}.${String(dateObjs[0].getMonth() + 1).padStart(2, '0')}.${String(dateObjs[0].getDate()).padStart(2, '0')}`;
  }
  
  // UIの更新 (IDが存在する場合)
  // 総合魔力はgainExp内で更新されるためここでは処理しない
  const elDays = document.getElementById('displayTotalDays');
  const unlocked = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
  if (elDays) elDays.innerHTML = `${unlocked.length}<span class="habit-unit">個</span>`;
  
  // ご要望により、UI上の表示も「連続記録日4日」に固定（実態が4未満の場合）
  if (streak < 4) streak = 4;
  
  const elStreak = document.getElementById('displayStreakDays');
  if (elStreak) elStreak.innerHTML = `🔥${streak}<span class="habit-unit">日</span>`;
  
  const elDiaries = document.getElementById('displayTotalDiaries');
  if (elDiaries) elDiaries.innerHTML = `${totalDiaries}<span class="habit-unit">件</span>`;
  
  const elLastLogin = document.getElementById('displayLastLogin');
  if (elLastLogin) elLastLogin.textContent = lastLoginStr;
  
  const actualNow = new Date();
  
  const elTodayMonth = document.getElementById('todayMonthDisplay');
  if (elTodayMonth) elTodayMonth.textContent = `${actualNow.getMonth() + 1}月`;
  const elTodayDay = document.getElementById('todayDayDisplay');
  if (elTodayDay) elTodayDay.textContent = `${actualNow.getDate()}日`;
  const elTodayStreak = document.getElementById('todayStreakDisplay');
  if (elTodayStreak) elTodayStreak.textContent = streak;

  // 過去の日記からの自動EXP付与は行わない（同期でのいきなり成長を防止）

  // 6月1〜3日の遡及EXP付与（初回のみ）
  if (typeof window.retroGrantJuneExp === 'function') {
    window.retroGrantJuneExp();
    // 遡及EXP付与でレベルが上がった場合などに備え、実績も再チェックする
    if (typeof checkAchievements === 'function') {
      checkAchievements();
    }
  }
}

function applyFilters() {
  const searchVal = (document.getElementById('diarySearchInput')?.value || '').toLowerCase();
  const dateVal = document.getElementById('diaryDateFilter')?.value || '';
  const assignments = getTagAssignments();

  filteredDiaries = allDiaries.filter(d => {
    const title = (d.summary || '').toLowerCase();
    const desc = (d.description || '').toLowerCase();
    // キーワードフィルター
    if (searchVal && !title.includes(searchVal) && !desc.includes(searchVal)) return false;
    // 日付フィルター
    if (dateVal && d.start.date !== dateVal) return false;
    // タグフィルター
    if (activeTagFilter) {
      const diaryTags = assignments[d.id] || [];
      if (!diaryTags.includes(activeTagFilter)) return false;
    }
    return true;
  });

  currentPage = 1;
  renderCurrentPage();
}

function renderCurrentPage() {
  const container = document.getElementById('recentEntries');
  const pagination = document.getElementById('diaryPagination');
  if (!container) return;
  container.innerHTML = '';

  const totalPages = Math.max(1, Math.ceil(filteredDiaries.length / ITEMS_PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, filteredDiaries.length);
  const assignments = getTagAssignments();
  const tags = getTags();

  if (filteredDiaries.length === 0) {
    container.innerHTML = '<div style="text-align:center; color: var(--text-muted); padding: 20px;">該当する日記がありません</div>';
    if (pagination) pagination.style.display = 'none';
    return;
  }

  for (let i = start; i < end; i++) {
    const diary = filteredDiaries[i];
    const card = document.createElement('div');
    card.className = 'diary-card';
    card.style.cursor = 'pointer';

    const dateObj = new Date(diary.start.date);
    const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
    let title = diary.summary || '無題';
    const desc = diary.description || '';
    let preview = desc.replace(/\n/g, ' ');

    // 検索ワードのハイライトとスニペット抽出
    const searchInput = document.getElementById('diarySearchInput');
    const searchWord = searchInput ? searchInput.value.trim() : '';
    if (searchWord) {
      const matchIndex = preview.toLowerCase().indexOf(searchWord.toLowerCase());
      if (matchIndex > -1) {
        const start = Math.max(0, matchIndex - 15);
        const end = Math.min(preview.length, matchIndex + searchWord.length + 30);
        preview = (start > 0 ? '...' : '') + preview.substring(start, end) + (end < preview.length ? '...' : '');
      } else {
        if (preview.length > 50) preview = preview.substring(0, 50) + '...';
      }

      const escaped = searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const highlight = `<mark style="background: transparent; border-bottom: 3px solid var(--accent-cyan); color: inherit;">$1</mark>`;
      title = title.replace(regex, highlight);
      preview = preview.replace(regex, highlight);
    } else {
      if (preview.length > 50) preview = preview.substring(0, 50) + '...';
    }

    // タグバッジ
    const diaryTags = assignments[diary.id] || [];
    let tagHtml = '';
    diaryTags.forEach(tName => {
      const t = tags.find(x => x.name === tName);
      if (t) {
        tagHtml += `<span class="tag-badge" style="background:${t.color}33; color:${t.color}; font-size:0.65rem; padding:2px 8px;">${t.name}</span>`;
      }
    });

    // 通し番号（全体の中での番号）
    const globalIndex = allDiaries.indexOf(diary);
    const num = allDiaries.length - globalIndex;

    card.innerHTML = `
      <div class="diary-date">${num} | ${dateStr}</div>
      <div class="diary-title">${title}</div>
      <div class="diary-preview">${preview}</div>
      <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">${tagHtml}</div>
      <div class="diary-reactions">
        <span class="diary-xp" style="color: #6b7280; text-shadow: none;">(同期済)</span>
      </div>
    `;

    // タップで日記詳細モーダルを開く
    card.addEventListener('click', () => openDiaryDetailModal(diary));
    container.appendChild(card);
  }

  // ページネーション
  if (pagination) {
    pagination.style.display = 'flex';
    document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages}`;
    const prevBtn = document.getElementById('pagePrev');
    const nextBtn = document.getElementById('pageNext');
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }
}

// 日記詳細モーダル
function openDiaryDetailModal(diary, isSwipe = false) {
  // 閲覧回数をカウント（ステータスの「愛情」パラメーターに影響）
  let views = parseInt(localStorage.getItem('diaryViewCount') || '0', 10);
  localStorage.setItem('diaryViewCount', views + 1);

  const existing = document.querySelector('.diary-detail-overlay');
  if (existing) {
    existing.remove();
    document.body.style.overflow = '';
  }
  
  // モーダルを開いている間は背景のスクロールを無効化
  document.body.style.overflow = 'hidden';

  const title = diary.summary || '無題';
  let desc = diary.description || '';
  
  // 写真URLの抽出 (【添付写真】の後のURL)
  let photoUrl = '';
  const photoMatch = desc.match(/【添付写真】\s*(https?:\/\/[^\s]+)/);
  if (photoMatch) {
    photoUrl = photoMatch[1];
    desc = desc.replace(photoMatch[0], '').trim();
  }
  
  // 改行を <br> に変換
  let formattedDesc = desc.replace(/\n/g, '<br>');
  let displayTitle = title;
  
  // 検索ワードのハイライト処理（詳細モーダル用）
  const searchInput = document.getElementById('diarySearchInput');
  const searchWord = searchInput ? searchInput.value.trim() : '';
  if (searchWord) {
    const escaped = searchWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const highlight = `<mark style="background: transparent; border-bottom: 3px solid var(--accent-cyan); color: inherit;">$1</mark>`;
    displayTitle = displayTitle.replace(regex, highlight);
    formattedDesc = formattedDesc.replace(regex, highlight);
  }

  const dateObj = new Date(diary.start.date);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${dateObj.getFullYear()}年${dateObj.getMonth() + 1}月${dateObj.getDate()}日 (${weekdays[dateObj.getDay()]})`;

  const assignments = getTagAssignments();
  const tags = getTags();
  const currentTags = assignments[diary.id] || [];
  
  let tagHtml = '';
  currentTags.forEach(tName => {
    const t = tags.find(x => x.name === tName);
    if (t) {
      tagHtml += `<span class="tag-badge" style="background:${t.color}33; color:${t.color}; font-size:0.75rem; padding:4px 10px;">${t.name}</span>`;
    }
  });

  const overlay = document.createElement('div');
  overlay.className = 'diary-detail-overlay tag-edit-overlay';
  if (isSwipe) overlay.style.animation = 'none';
  overlay.innerHTML = `
    <div class="tag-edit-modal" style="width: 100%; height: 100dvh; max-width: none; border-radius: 0; border: none; display: flex; flex-direction: column; padding: 20px; box-sizing: border-box; background: #0a0f1e; overflow: hidden;">
      <div id="detailViewMode" style="display: flex; flex-direction: column; flex: 1; overflow: hidden; min-height: 0;">
        <h3 style="font-size: 1.2rem; margin-bottom: 5px; flex-shrink: 0; color: #ffffff;">${displayTitle}</h3>
        <div style="font-size: 1.1rem; color: var(--accent-cyan); font-weight: bold; margin-bottom: 15px; flex-shrink: 0; display: flex; align-items: center; gap: 6px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          ${dateStr}
        </div>
        <div style="flex: 1; overflow-y: auto; margin-bottom: 15px; line-height: 1.6; font-size: 0.95rem; word-break: break-word; min-height: 0;">
          ${formattedDesc}
          ${photoUrl ? `<div style="margin-top: 15px;"><a href="${photoUrl}" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">添付写真を見る (Google Drive)</a></div>` : ''}
        </div>
        <div style="margin-bottom: 15px; flex-shrink: 0;">
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 5px;">タグ</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; min-height: 24px;">${tagHtml || '<span style="color:var(--text-muted); font-size:0.8rem;">なし</span>'}</div>
        </div>
        <div style="display: flex; gap: 10px; flex-shrink: 0; padding-bottom: max(env(safe-area-inset-bottom), 10px);">
          <button class="cyber-button" id="detailEditContentBtn" style="flex: 1; padding: 12px; background: rgba(0,240,255,0.1);">内容を編集</button>
          <button class="cyber-button" id="detailEditTagBtn" style="flex: 1; padding: 12px;">タグを編集</button>
          <button class="tag-edit-close" id="detailCloseBtn" style="flex: 1; margin: 0; padding: 12px;">閉じる</button>
        </div>
      </div>
      <div id="detailEditMode" style="display: none; flex-direction: column; flex: 1; height: 100%; overflow: hidden; min-height: 0;">
        <input type="text" id="editDiaryTitle" value="${diary.summary || ''}" style="margin-bottom: 10px; flex-shrink: 0; background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 12px; border-radius: 8px; font-size: 1rem; width: 100%; box-sizing: border-box;" placeholder="タイトル">
        <textarea id="editDiaryDesc" style="flex: 1; margin-bottom: 15px; font-family: var(--font-body); resize: none; background: rgba(255,255,255,0.05); border: 1px solid var(--border-subtle); color: var(--text-primary); padding: 12px; border-radius: 8px; font-size: 1rem; width: 100%; box-sizing: border-box; line-height: 1.5; min-height: 0;">${diary.description || ''}</textarea>
        <div style="display: flex; gap: 10px; flex-shrink: 0; padding-bottom: max(env(safe-area-inset-bottom), 10px);">
          <button class="cyber-button" id="detailSaveBtn" style="flex: 1; padding: 12px; background: rgba(16,185,129,0.2); border-color: #10b981; color: #6ee7b7;">保存</button>
          <button class="tag-edit-close" id="detailCancelEditBtn" style="flex: 1; margin: 0; padding: 12px;">キャンセル</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('detailCloseBtn').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
  });
  document.getElementById('detailEditTagBtn').addEventListener('click', () => {
    overlay.remove();
    document.body.style.overflow = '';
    openTagEditModal(diary.id, title);
  });
  
  // スワイプによる日記切り替え機能
  let startX = 0;
  let startY = 0;
  overlay.addEventListener('touchstart', (e) => {
    // 編集モード中はスワイプを無視
    if (document.getElementById('detailEditMode').style.display !== 'none') return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  overlay.addEventListener('touchend', (e) => {
    if (document.getElementById('detailEditMode').style.display !== 'none') return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - startX;
    const diffY = endY - startY;

    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      // フィルター済みリストに存在するか確認（検索やタグ絞り込み時の一貫性維持）
      let targetList = filteredDiaries.find(d => d.id === diary.id) ? filteredDiaries : allDiaries;
      const currentIndex = targetList.findIndex(d => d.id === diary.id);
      if (currentIndex === -1) return;

      let nextIndex = -1;
      if (diffX > 0) {
        // 右にスワイプ（前へ = 古い日記へ）※逆にする
        nextIndex = currentIndex + 1;
      } else {
        // 左にスワイプ（次へ = 新しい日記へ）※逆にする
        nextIndex = currentIndex - 1;
      }

      if (nextIndex >= 0 && nextIndex < targetList.length) {
        if (typeof window.playSE === 'function') window.playSE('shuffle');
        overlay.remove();
        document.body.style.overflow = '';
        openDiaryDetailModal(targetList[nextIndex], true);
      }
    }
  });
  
  // 編集モードへの切り替え
  document.getElementById('detailEditContentBtn').addEventListener('click', () => {
    document.getElementById('detailViewMode').style.display = 'none';
    document.getElementById('detailEditMode').style.display = 'flex';
  });

  // 編集キャンセル
  document.getElementById('detailCancelEditBtn').addEventListener('click', () => {
    document.getElementById('detailEditMode').style.display = 'none';
    document.getElementById('detailViewMode').style.display = 'flex';
  });

  // 保存処理
  document.getElementById('detailSaveBtn').addEventListener('click', async () => {
    const newTitle = document.getElementById('editDiaryTitle').value.trim() || '無題';
    const newDesc = document.getElementById('editDiaryDesc').value;
    const saveBtn = document.getElementById('detailSaveBtn');
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;

    const doUpdate = async () => {
      try {
        const eventRes = await gapi.client.calendar.events.get({
          calendarId: 'primary',
          eventId: diary.id
        });
        const eventData = eventRes.result;
        eventData.summary = newTitle;
        eventData.description = newDesc;

        await gapi.client.calendar.events.update({
          calendarId: 'primary',
          eventId: diary.id,
          resource: eventData
        });

        overlay.remove();
        document.body.style.overflow = '';
        fetchDiariesFromCalendar();
      } catch (e) {
        console.error(e);
        alert('保存に失敗しました。');
        saveBtn.textContent = '保存';
        saveBtn.disabled = false;
      }
    };

    const exp = localStorage.getItem('gapi_token_expires_at');
    if (!isAuthorized || !exp || Date.now() > parseInt(exp)) {
      tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
          alert('認証に失敗しました。設定からログインしてください。');
          saveBtn.textContent = '保存';
          saveBtn.disabled = false;
          return;
        }
        localStorage.setItem('hasLoggedInBefore', 'true');
        localStorage.setItem('gapi_access_token', resp.access_token);
        localStorage.setItem('gapi_token_expires_at', Date.now() + resp.expires_in * 1000);
        gapi.client.setToken({ access_token: resp.access_token });
        isAuthorized = true;
        updateAuthStatus();
        await doUpdate();
      };
      tokenClient.requestAccessToken({prompt: ''});
    } else {
      doUpdate();
    }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// タグ編集モーダル（日記カードタップ時）
function openTagEditModal(eventId, title) {
  const existing = document.querySelector('.tag-edit-overlay');
  if (existing) existing.remove();

  const tags = getTags();
  const assignments = getTagAssignments();
  const currentTags = assignments[eventId] || [];

  const overlay = document.createElement('div');
  overlay.className = 'tag-edit-overlay';
  overlay.innerHTML = `
    <div class="tag-edit-modal">
      <h3>「${title}」のタグ編集</h3>
      <div class="tag-edit-tags" id="tagEditTags"></div>
      <button class="tag-edit-close" id="tagEditClose">閉じる</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const tagsContainer = document.getElementById('tagEditTags');
  tags.forEach(tag => {
    const btn = document.createElement('span');
    btn.className = 'tag-badge' + (currentTags.includes(tag.name) ? ' active' : '');
    btn.style.background = tag.color + '33';
    btn.style.color = tag.color;
    btn.textContent = tag.name;
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      // 保存
      const a = getTagAssignments();
      const cur = a[eventId] || [];
      if (btn.classList.contains('active')) {
        if (!cur.includes(tag.name)) cur.push(tag.name);
      } else {
        const idx = cur.indexOf(tag.name);
        if (idx >= 0) cur.splice(idx, 1);
      }
      a[eventId] = cur;
      saveTagAssignments(a);
    });
    tagsContainer.appendChild(btn);
  });

  if (tags.length === 0) {
    tagsContainer.innerHTML = '<div style="color: var(--text-muted); font-size: 0.85rem;">設定画面でタグを作成してください</div>';
  }

  document.getElementById('tagEditClose').addEventListener('click', () => {
    overlay.remove();
    renderCurrentPage(); // タグ更新を反映
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      renderCurrentPage();
    }
  });
}

// タグフィルターボタンの描画
function renderTagFilters() {
  const container = document.getElementById('diaryTagFilter');
  if (!container) return;
  container.innerHTML = '';
  const tags = getTags();

  // 「すべて」ボタン
  const allBtn = document.createElement('span');
  allBtn.className = 'tag-badge' + (activeTagFilter === null ? ' active' : '');
  allBtn.style.background = 'rgba(255,255,255,0.1)';
  allBtn.style.color = '#ffffff';
  allBtn.textContent = 'すべて';
  allBtn.addEventListener('click', () => {
    activeTagFilter = null;
    applyFilters();
    renderTagFilters();
  });
  container.appendChild(allBtn);

  tags.forEach(tag => {
    const btn = document.createElement('span');
    btn.className = 'tag-badge' + (activeTagFilter === tag.name ? ' active' : '');
    btn.style.background = tag.color + '33';
    btn.style.color = tag.color;
    btn.textContent = tag.name;
    btn.addEventListener('click', () => {
      activeTagFilter = activeTagFilter === tag.name ? null : tag.name;
      applyFilters();
      renderTagFilters();
    });
    container.appendChild(btn);
  });
}

// 日記作成画面のタグ選択
let selectedWriteTags = [];
function renderWriteTags() {
  const container = document.getElementById('writeTagList');
  if (!container) return;
  container.innerHTML = '';
  const tags = getTags();
  tags.forEach(tag => {
    const btn = document.createElement('span');
    btn.className = 'tag-badge' + (selectedWriteTags.includes(tag.name) ? ' active' : '');
    btn.style.background = tag.color + '33';
    btn.style.color = tag.color;
    btn.textContent = tag.name;
    btn.addEventListener('click', () => {
      if (selectedWriteTags.includes(tag.name)) {
        selectedWriteTags = selectedWriteTags.filter(t => t !== tag.name);
      } else {
        selectedWriteTags.push(tag.name);
      }
      renderWriteTags();
    });
    container.appendChild(btn);
  });
}

// ==========================================
// 5. カレンダー（動的生成）
// ==========================================
let calYear, calMonth;
function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  document.getElementById('calPrev')?.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  document.getElementById('calNext')?.addEventListener('click', () => {
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
  renderCalendar();
}

function renderCalendar() {
  const titleEl = document.getElementById('calMonthTitle');
  const grid = document.getElementById('calendarGrid');
  if (!titleEl || !grid) return;

  titleEl.textContent = `${calYear}年 ${calMonth + 1}月`;
  grid.innerHTML = '';

  // 曜日ヘッダー
  ['日','月','火','水','木','金','土'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  // 日記がある日を集める
  const diaryDates = new Set();
  allDiaries.forEach(d => {
    if (d.start && d.start.date) {
      const dt = new Date(d.start.date);
      if (dt.getFullYear() === calYear && dt.getMonth() === calMonth) {
        diaryDates.add(dt.getDate());
      }
    }
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  // 空白セル
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement('div'));
  }
  // 日付セル
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.textContent = d;
    const hasDiary = diaryDates.has(d);
    if (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear()) {
      cell.className = 'cal-today';
    } else if (hasDiary) {
      cell.className = 'cal-logged';
    }
    // タップで日記を表示
    if (hasDiary || (d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear())) {
      cell.style.cursor = 'pointer';
    }
    const dayNum = d;
    cell.addEventListener('click', () => {
      // 選択状態のハイライト
      grid.querySelectorAll('.cal-selected').forEach(el => el.classList.remove('cal-selected'));
      cell.classList.add('cal-selected');
      showCalendarDiaries(calYear, calMonth, dayNum);
    });
    grid.appendChild(cell);
  }

  // プレビューをクリア
  const preview = document.getElementById('calDiaryPreview');
  if (preview) preview.innerHTML = '';
}

let calSelectedYear = null;
let calSelectedMonth = null;
let calSelectedDay = null;
let isCalSwipeInitialized = false;

function initCalendarSwipe() {
  if (isCalSwipeInitialized) return;
  const preview = document.getElementById('calDiaryPreview');
  if (!preview) return;

  let startX = 0;
  let startY = 0;

  preview.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  preview.addEventListener('touchend', (e) => {
    if (calSelectedYear === null) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - startX;
    const diffY = endY - startY;

    // 水平方向へのスワイプが一定以上かつ、垂直方向より大きい場合
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
      const dt = new Date(calSelectedYear, calSelectedMonth, calSelectedDay);
      if (diffX > 0) {
        // 右にスワイプ（前日へ）
        dt.setDate(dt.getDate() - 1);
      } else {
        // 左にスワイプ（翌日へ）
        dt.setDate(dt.getDate() + 1);
      }

      // 月がまたがる場合はカレンダーを再描画
      const newYear = dt.getFullYear();
      const newMonth = dt.getMonth();
      const newDay = dt.getDate();

      if (newMonth !== calMonth || newYear !== calYear) {
        calYear = newYear;
        calMonth = newMonth;
        renderCalendar();
      }

      // カレンダーの選択状態を更新
      const grid = document.getElementById('calendarGrid');
      if (grid) {
        grid.querySelectorAll('.cal-selected').forEach(el => el.classList.remove('cal-selected'));
        // 今の月の中の対応する日付セルを探す
        const cells = grid.querySelectorAll('div');
        cells.forEach(cell => {
          if (parseInt(cell.textContent) === newDay && !cell.classList.contains('cal-header')) {
            cell.classList.add('cal-selected');
          }
        });
      }

      // 日付を更新してプレビュー表示
      showCalendarDiaries(newYear, newMonth, newDay);
    }
  });

  isCalSwipeInitialized = true;
}

function showCalendarDiaries(year, month, day) {
  calSelectedYear = year;
  calSelectedMonth = month;
  calSelectedDay = day;

  initCalendarSwipe();

  const preview = document.getElementById('calDiaryPreview');
  if (!preview) return;
  preview.innerHTML = '';

  // YYYY-MM-DD形式で比較
  const targetDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const matches = allDiaries.filter(d => d.start.date === targetDate);
  const assignments = getTagAssignments();
  const tags = getTags();

  if (matches.length === 0) {
    preview.innerHTML = `<div class="dummy-card" style="text-align:center; color: var(--text-muted); padding: 15px;">${month + 1}月${day}日の日記はありません</div>`;
    return;
  }

  matches.forEach(diary => {
    const card = document.createElement('div');
    card.className = 'diary-card';
    card.style.cursor = 'pointer';

    const title = diary.summary || '無題';
    const desc = diary.description || '';
    let preview_text = desc.replace(/\n/g, ' ');
    if (preview_text.length > 80) preview_text = preview_text.substring(0, 80) + '...';

    // タグ
    const diaryTags = assignments[diary.id] || [];
    let tagHtml = '';
    diaryTags.forEach(tName => {
      const t = tags.find(x => x.name === tName);
      if (t) {
        tagHtml += `<span class="tag-badge" style="background:${t.color}33; color:${t.color}; font-size:0.65rem; padding:2px 8px;">${t.name}</span>`;
      }
    });

    card.innerHTML = `
      <div class="diary-date">${month + 1}月${day}日</div>
      <div class="diary-title">${title}</div>
      <div class="diary-preview">${preview_text}</div>
      <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">${tagHtml}</div>
    `;

    card.addEventListener('click', () => openDiaryDetailModal(diary));
    preview.appendChild(card);
  });
}

// ==========================================
// 6. 実績システム（段階的獲得）
// ==========================================
const ACHIEVEMENTS = [
  { id: 'first_step', name: 'はじめの一歩', desc: '累計1件', icon: 'assets/ui/badge_first_step.png', condition: (count, total, level, streak) => total >= 1 },
  { id: '3days', name: '三日坊主突破', desc: '累計3件', icon: 'assets/ui/badge_3days.png', condition: (count, total, level, streak) => total >= 3 },
  { id: 'birth', name: '竜の誕生', desc: '累計5件', icon: 'assets/ui/badge_birth.png', condition: (count, total, level, streak) => total >= 5 },
  { id: '1week', name: '一週間の記録', desc: '累計7件', icon: 'assets/ui/badge_1week.png', condition: (count, total, level, streak) => total >= 7 },
  { id: '2weeks', name: '二週間の軌跡', desc: '累計14件', icon: 'assets/ui/badge_2weeks.png', condition: (count, total, level, streak) => total >= 14 },
  { id: '1month', name: '一ヶ月の継続', desc: '累計30件', icon: 'assets/ui/badge_1month.png', condition: (count, total, level, streak) => total >= 30 },
  { id: '50days', name: '半百の記録', desc: '累計50件', icon: 'assets/ui/badge_50days.png', condition: (count, total, level, streak) => total >= 50 },
  { id: '100days', name: '百日草', desc: '累計100件', icon: 'assets/ui/badge_100days.png', condition: (count, total, level, streak) => total >= 100 },
  
  // 連続記録実績
  { id: 'streak_3', name: '炎の三日間', desc: '連続3日', icon: 'assets/ui/badge_first_step.png', condition: (count, total, level, streak) => streak >= 3 },
  { id: 'streak_7', name: '一週間の熱狂', desc: '連続7日', icon: 'assets/ui/badge_1week.png', condition: (count, total, level, streak) => streak >= 7 },
  { id: 'streak_30', name: '三十日の執念', desc: '連続30日', icon: 'assets/ui/badge_1month.png', condition: (count, total, level, streak) => streak >= 30 },

  // プレイヤーレベル実績（経験値獲得ポイントに応じた実績）
  { id: 'lv2', name: '竜の目覚め', desc: 'プレイヤーLv2到達', icon: 'assets/ui/badge_first_step.png', condition: (count, total, level, streak, exp) => level >= 2 },
  { id: 'lv3', name: '竜騎士の道', desc: 'プレイヤーLv3到達', icon: 'assets/ui/badge_3days.png', condition: (count, total, level, streak, exp) => level >= 3 },
  { id: 'lv4', name: '絆の深まり', desc: 'プレイヤーLv4到達', icon: 'assets/ui/badge_birth.png', condition: (count, total, level, streak, exp) => level >= 4 },
  { id: 'lv5', name: '共鳴する心', desc: 'プレイヤーLv5到達', icon: 'assets/ui/badge_1week.png', condition: (count, total, level, streak, exp) => level >= 5 },
  { id: 'lv7', name: '大空への憧れ', desc: 'プレイヤーLv7到達', icon: 'assets/ui/badge_2weeks.png', condition: (count, total, level, streak, exp) => level >= 7 },

  // シークレット実績
  { id: 'secret_999', name: '伝説の探求者', desc: '秘密の条件', icon: 'assets/ui/badge_100diary.png', condition: (count, total, level, streak, exp) => total >= 999, isSecret: true },
  { id: 'secret_1000', name: '千年竜の契り（勲章）', desc: '秘密の条件', icon: 'assets/ui/badge_master.png', condition: (count, total, level, streak, exp) => total >= 1000, isSecret: true },
  
  // プレイヤーレベルのシークレット実績
  { id: 'secret_lv10', name: '見習い竜使い', desc: '秘密の条件', icon: 'assets/ui/badge_lv10.png', condition: (count, total, level, streak, exp) => level >= 10, isSecret: true },
  { id: 'secret_lv30', name: '熟練の竜使い', desc: '秘密の条件', icon: 'assets/ui/badge_claw.png', condition: (count, total, level, streak, exp) => level >= 30, isSecret: true },
  { id: 'secret_lv50', name: '竜の導き手', desc: '秘密の条件', icon: 'assets/ui/badge_eye.png', condition: (count, total, level, streak, exp) => level >= 50, isSecret: true },
  { id: 'secret_lv100', name: 'マスタードラゴン（勲章）', desc: '秘密の条件', icon: 'assets/ui/badge_master.png', condition: (count, total, level, streak, exp) => level >= 100, isSecret: true },
];

function getUnlockedAchievements() {
  return JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
}
function saveUnlockedAchievements(unlocked) {
  localStorage.setItem('unlockedAchievements', JSON.stringify(unlocked));
}
function getAchievementDates() {
  const dates = JSON.parse(localStorage.getItem('dragonDiaryAchievementDates') || '{}');
  let updated = false;
  
  // 過去の実績日時の遡及設定
  if (!dates['first_step']) {
    dates['first_step'] = new Date(2026, 5, 1).getTime(); // 2026年6月1日
    updated = true;
  }
  if (!dates['3days']) {
    dates['3days'] = new Date(2026, 5, 3).getTime(); // 2026年6月3日
    updated = true;
  }
  
  if (updated) {
    saveAchievementDates(dates);
  }
  return dates;
}
function saveAchievementDates(dates) {
  localStorage.setItem('dragonDiaryAchievementDates', JSON.stringify(dates));
}

function showAchievementDetail(a, isUnlocked) {
  const dates = getAchievementDates();
  const dateMs = dates[a.id];
  let dateStr = '未獲得';
  if (isUnlocked) {
    if (dateMs) {
      const d = new Date(dateMs);
      dateStr = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 獲得`;
    } else {
      dateStr = '獲得済み';
    }
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.style.zIndex = '3000';
  modal.innerHTML = `
    <div class="modal-content cyber-panel" style="text-align: center; max-width: 300px;">
      <img src="${a.icon}" style="width: 80px; height: 80px; margin-bottom: 15px; filter: ${isUnlocked ? 'none' : 'grayscale(100%) opacity(0.5)'};">
      <h3 style="margin-bottom: 10px; color: ${isUnlocked ? 'var(--accent-cyan)' : 'var(--text-muted)'};">${isUnlocked ? a.name : '???'}</h3>
      <p style="margin-bottom: 10px; font-size: 0.95rem; color: var(--text-color);">条件: ${a.desc}</p>
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px;">${dateStr}</div>
      <button class="cyber-button" onclick="this.closest('.modal-overlay').remove()">閉じる</button>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

function checkAchievements() {
  // 実績判定の基準値（count）を、「6月1日以降に書いた日記の件数」にする
  const juneFirst = new Date(2026, 5, 1).getTime();
  let count = 0;
  let totalCount = 0;
  if (window.allDiaries) {
    totalCount = window.allDiaries.length;
    window.allDiaries.forEach(d => {
      let dateObj = d.start && (d.start.date || d.start.dateTime);
      if (dateObj && new Date(dateObj).getTime() >= juneFirst) {
        count++;
      }
    });
  }

  let unlocked = getUnlockedAchievements();
  let dates = getAchievementDates();
  let newlyUnlocked = [];
  
  // main.js のグローバル変数 playerLevel を取得（なければ 1）
  const currentLevel = window.playerLevel || 1;
  const currentExp = window.playerExp || 0;
  const streak = calculateStreak();

  ACHIEVEMENTS.forEach(a => {
    if (a.condition(count, totalCount, currentLevel, streak, currentExp) && !unlocked.includes(a.id)) {
      unlocked.push(a.id);
      newlyUnlocked.push(a);
      dates[a.id] = Date.now();
    }
  });
  
  if (newlyUnlocked.length > 0) {
    saveUnlockedAchievements(unlocked);
    saveAchievementDates(dates);
    renderAchievements();

    // 新規解放された実績を通知する
    newlyUnlocked.forEach((a, index) => {
      setTimeout(() => {
        if (typeof window.showAchievementToast === 'function') {
          window.showAchievementToast(a.name, a.icon);
        }
      }, index * 4500); // 複数ある場合はずらして表示
    });
  }
  
  // UIの更新 (実績数)
  const elDays = document.getElementById('displayTotalDays');
  if (elDays) {
    elDays.innerHTML = `${unlocked.length}<span class="habit-unit">個</span>`;
  }
}

function renderAchievements() {
  const grid = document.getElementById('achievementsGrid');
  const homeGrid = document.getElementById('homeBadgeGrid');
  const unlocked = getUnlockedAchievements();
  
  if (grid) {
    grid.innerHTML = '';
    ACHIEVEMENTS.forEach(a => {
      const isUnlocked = unlocked.includes(a.id);
      
      // シークレットかつ未解放の場合は表示しない（開発者モード中は強制表示）
      if (a.isSecret && !isUnlocked) {
        return;
      }

      const card = document.createElement('div');
      card.className = 'achievement-card ' + (isUnlocked ? 'unlocked' : 'locked');
      card.style.cursor = 'pointer';
      card.onclick = () => showAchievementDetail(a, isUnlocked);
      card.innerHTML = `
        <img src="${a.icon}" class="achieve-icon-img">
        <div class="achieve-name">${isUnlocked ? a.name : '???'}</div>
      `;
      grid.appendChild(card);
    });
  }

  if (homeGrid) {
    homeGrid.innerHTML = '';
    const unlockedAchievements = ACHIEVEMENTS.filter(a => unlocked.includes(a.id));
    // 最新の獲得実績を3つまで表示
    unlockedAchievements.slice(-3).reverse().forEach(a => {
      const div = document.createElement('div');
      div.className = 'achieve-badge';
      div.style.cursor = 'pointer';
      div.onclick = () => showAchievementDetail(a, true);
      div.innerHTML = `<img src="${a.icon}" class="badge-img"><span>${a.name}</span>`;
      homeGrid.appendChild(div);
    });
    if (unlockedAchievements.length === 0) {
      homeGrid.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; padding: 10px;">まだ実績がありません</div>';
    }
  }
}

// ==========================================
// 7. 日記の保存（カレンダーへ書き込み）
// ==========================================
window.saveDiaryToGoogle = async function(title, body, file, targetDateStr) {
  return new Promise((resolve) => {
    const doSave = async () => {
      try {
        let description = body;
        if (file) {
          const folderId = await getOrCreateFolder('マイ日記');
          const photoUrl = await uploadPhotoToDrive(file, folderId);
          description += `\n\n【添付写真】\n${photoUrl}`;
        }
        const startDate = new Date(targetDateStr);
        const endDate = new Date(startDate.getTime() + 86400000);
        const endStr = endDate.getFullYear() + '-' + String(endDate.getMonth() + 1).padStart(2, '0') + '-' + String(endDate.getDate()).padStart(2, '0');
        const event = {
          summary: title,
          description: description,
          start: { date: targetDateStr },
          end: { date: endStr }
        };
        const result = await gapi.client.calendar.events.insert({
          calendarId: 'primary',
          resource: event
        });

        if (selectedWriteTags.length > 0 && result.result.id) {
          const assignments = getTagAssignments();
          assignments[result.result.id] = [...selectedWriteTags];
          saveTagAssignments(assignments);
          selectedWriteTags = [];
        }

        fetchDiariesFromCalendar();
        resolve(true);
      } catch (err) {
        console.error('Save Diary Error:', err);
        alert('保存中にエラーが発生しました。');
        resolve(false);
      }
    };

    const exp = localStorage.getItem('gapi_token_expires_at');
    if (!isAuthorized || !exp || Date.now() > parseInt(exp)) {
      tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
          alert('認証に失敗しました。設定からログインしてください。');
          resolve(false);
          return;
        }
        localStorage.setItem('hasLoggedInBefore', 'true');
        localStorage.setItem('gapi_access_token', resp.access_token);
        localStorage.setItem('gapi_token_expires_at', Date.now() + resp.expires_in * 1000);
        gapi.client.setToken({ access_token: resp.access_token });
        isAuthorized = true;
        updateAuthStatus();
        await doSave();
      };
      tokenClient.requestAccessToken({prompt: ''});
    } else {
      doSave();
    }
  });
};

// ==========================================
// 8. UI 初期化
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const authBtn = document.getElementById('googleAuthButton');
  if (authBtn) {
    if (gapiInited && gisInited) {
      if (isAuthorized) {
        updateAuthStatus();
      } else {
        authBtn.disabled = false;
        authBtn.textContent = 'Googleでログイン';
        authBtn.onclick = handleAuthClick;
      }
    } else {
      authBtn.disabled = true;
      authBtn.textContent = '読み込み中...';
      authBtn.onclick = handleAuthClick;
      
      // 10秒待っても読み込まれない場合はタイムアウトとする（通信エラーや広告ブロッカー等）
      setTimeout(() => {
        if (!gapiInited || !gisInited) {
          const btn = document.getElementById('googleAuthButton');
          if (btn && btn.textContent === '読み込み中...') {
            btn.textContent = '読込タイムアウト(再読込推奨)';
            btn.disabled = false;
            btn.onclick = () => location.reload();
          }
        }
      }, 10000);
    }
  }

  // 日記作成画面の日付を今日（基準日）にセット
  const writeDateInput = document.getElementById('writeDateInput');
  if (writeDateInput) {
    writeDateInput.value = window.getVirtualTodayStr();
  }

  // 写真添付機能
  const fileInput = document.getElementById('diaryPhotoInput');
  const previewContainer = document.getElementById('photoPreviewContainer');
  const previewImg = document.getElementById('photoPreview');
  const removeBtn = document.getElementById('removePhotoBtn');
  const attachBtn = document.getElementById('photoAttachBtn');

  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
          previewContainer.style.display = 'block';
          attachBtn.style.display = 'none';
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    });
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.value = '';
      previewContainer.style.display = 'none';
      attachBtn.style.display = 'block';
    });
  }

  // 日記保存ボタン
  const saveBtn = document.querySelector('.save-button');
  const titleInput = document.querySelector('.write-input-title');
  const bodyInput = document.querySelector('.write-textarea');

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const title = titleInput.value.trim();
      const body = bodyInput.value.trim();
      const file = fileInput?.files[0];
      if (!title || !body) { alert('タイトルと本文を入力してください。'); return; }

      const originalText = saveBtn.textContent;
      saveBtn.textContent = '保存中...';
      saveBtn.disabled = true;

      const targetDateStr = document.getElementById('writeDateInput').value || window.getVirtualTodayStr();
      const success = await window.saveDiaryToGoogle(title, body, file, targetDateStr);

      saveBtn.textContent = originalText;
      saveBtn.disabled = false;

      if (success) {
        titleInput.value = '';
        bodyInput.value = '';
        if (removeBtn) removeBtn.click();
        const homeBtn = document.querySelector('[data-page="home"]');
        if (homeBtn) homeBtn.click();

        // 対象日が基準日の場合のみ経験値付与
        if (targetDateStr === window.getVirtualTodayStr() && typeof window.gainExp === 'function') {
          let exp = 20; // 基本経験値
          const textLen = body.replace(/\s+/g, '').length;
          let textBonus = Math.floor(textLen / 100) * 10;
          if (textBonus > 200) textBonus = 200;
          exp += textBonus;

          const streakText = document.getElementById('todayStreakDisplay').textContent || '0';
          const currentStreak = parseInt(streakText, 10);
          
          if (currentStreak >= 100) exp += 300;
          else if (currentStreak >= 30) exp += 100;
          else if (currentStreak >= 14) exp += 50;
          else if (currentStreak >= 7) exp += 30;
          else if (currentStreak >= 3) exp += 10;

          window.gainExp(exp);
        }
      }
    });
  }

  // 検索・フィルター イベント
  const searchInput = document.getElementById('diarySearchInput');
  const dateFilter = document.getElementById('diaryDateFilter');
  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (dateFilter) dateFilter.addEventListener('change', applyFilters);

  // ページネーション
  document.getElementById('pagePrev')?.addEventListener('click', () => {
    if (currentPage > 1) { currentPage--; renderCurrentPage(); }
  });
  document.getElementById('pageNext')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredDiaries.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) { currentPage++; renderCurrentPage(); }
  });

  // タグ管理初期化
  initTagManagement();
  renderTagFilters();
  renderWriteTags();

  // カレンダー初期化
  initCalendar();

  // 実績初期化
  renderAchievements();
});
