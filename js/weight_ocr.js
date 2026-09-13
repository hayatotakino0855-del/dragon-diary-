// js/weight_ocr.js
// 体重計の電子表示をカメラでその場読み取りし、日記に記録する機能。
// 撮影したフレームはメモリ上でOCR処理するだけで、保存・アップロードは一切行わない。

const WEIGHT_METRICS = [
  { key: 'weight', label: '体重', unit: 'kg' },
  { key: 'bodyFat', label: '体脂肪率', unit: '%' },
  { key: 'visceral', label: '内臓脂肪レベル', unit: '' },
  { key: 'bmi', label: 'BMI', unit: '' }
];

let weightReadings = {};
let currentMetricIndex = 0;
let currentStream = null;
let ocrWorker = null;

async function ensureOcrWorker() {
  if (!ocrWorker) {
    ocrWorker = await Tesseract.createWorker('eng');
    await ocrWorker.setParameters({ tessedit_char_whitelist: '0123456789.' });
  }
  return ocrWorker;
}

function captureCroppedFrame(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const cw = Math.round(vw * 0.7);
  const ch = Math.round(vh * 0.35);
  const cx = Math.round((vw - cw) / 2);
  const cy = Math.round((vh - ch) / 2);

  const canvas = document.getElementById('weightOcrCanvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
  return canvas;
}

// 単純な二値化（グレースケール化+閾値）でセグメント表示の視認性を上げる
function preprocessForOcr(canvas) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = gray > 128 ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function parseNumberFromText(text) {
  const match = text.match(/\d{1,3}(?:\.\d{1,2})?/);
  return match ? match[0] : '';
}

function stripExistingMarkers(text) {
  let result = text;
  WEIGHT_METRICS.forEach(m => {
    const re = new RegExp(`\\n{0,2}\\[${m.label}:[^\\]]*\\]`, 'g');
    result = result.replace(re, '');
  });
  return result.trim();
}

function commitReadingsToBody() {
  const bodyInput = document.getElementById('diaryBodyInput');
  if (!bodyInput) return;
  let text = stripExistingMarkers(bodyInput.value);
  const lines = WEIGHT_METRICS
    .filter(m => weightReadings[m.key])
    .map(m => `[${m.label}: ${weightReadings[m.key]}${m.unit}]`);
  if (lines.length > 0) {
    text = text ? `${text}\n\n${lines.join('\n')}` : lines.join('\n');
  }
  bodyInput.value = text;
}

function renderWeightRecordSummary() {
  const container = document.getElementById('weightRecordSummary');
  if (!container) return;
  const entries = WEIGHT_METRICS.filter(m => weightReadings[m.key]);
  if (entries.length === 0) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = entries.map(m => `
    <span class="tag-badge active" style="background:rgba(0,240,255,0.15); color:var(--accent-cyan); font-size:0.7rem; padding:3px 10px;">
      ${m.label}: ${weightReadings[m.key]}${m.unit}
    </span>
  `).join('');
}

function renderTabs(overlay) {
  const tabsContainer = overlay.querySelector('#weightOcrTabs');
  tabsContainer.innerHTML = '';
  WEIGHT_METRICS.forEach((m, idx) => {
    const btn = document.createElement('span');
    btn.className = 'tag-badge' + (idx === currentMetricIndex ? ' active' : '');
    btn.style.cursor = 'pointer';
    btn.style.background = idx === currentMetricIndex ? 'rgba(0,240,255,0.25)' : 'rgba(255,255,255,0.08)';
    btn.style.color = idx === currentMetricIndex ? 'var(--accent-cyan)' : 'var(--text-muted)';
    btn.textContent = m.label;
    btn.addEventListener('click', () => {
      currentMetricIndex = idx;
      updateCurrentMetricUI(overlay);
    });
    tabsContainer.appendChild(btn);
  });
}

function renderChips(overlay) {
  const container = overlay.querySelector('#weightOcrChips');
  container.innerHTML = '';
  WEIGHT_METRICS.forEach(m => {
    if (!weightReadings[m.key]) return;
    const chip = document.createElement('span');
    chip.className = 'tag-badge active';
    chip.style.background = 'rgba(16,185,129,0.15)';
    chip.style.color = '#6ee7b7';
    chip.innerHTML = `${m.label}: ${weightReadings[m.key]}${m.unit} <span style="cursor:pointer; margin-left:4px;" data-key="${m.key}">✕</span>`;
    container.appendChild(chip);
  });
  container.querySelectorAll('[data-key]').forEach(x => {
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      delete weightReadings[x.dataset.key];
      renderChips(overlay);
      renderWeightRecordSummary();
      updateCurrentMetricUI(overlay);
    });
  });
}

function updateCurrentMetricUI(overlay) {
  renderTabs(overlay);
  const m = WEIGHT_METRICS[currentMetricIndex];
  overlay.querySelector('#weightOcrCurrentLabel').textContent = m.label;
  overlay.querySelector('#weightOcrValueInput').value = weightReadings[m.key] || '';
  overlay.querySelector('#weightOcrStatus').textContent = '体重計の数字表示を枠に合わせて📸を押してください';
}

async function handleShutter(overlay) {
  const video = overlay.querySelector('#weightOcrVideo');
  const statusEl = overlay.querySelector('#weightOcrStatus');
  if (!video.srcObject) {
    statusEl.textContent = 'カメラが起動していません。数値は手動で入力できます。';
    return;
  }
  statusEl.textContent = '読み取り中...';
  try {
    const canvas = preprocessForOcr(captureCroppedFrame(video));
    const worker = await ensureOcrWorker();
    const { data: { text } } = await worker.recognize(canvas);
    const num = parseNumberFromText(text);
    const input = overlay.querySelector('#weightOcrValueInput');
    if (num) {
      input.value = num;
      statusEl.textContent = `読み取り結果: ${num}（間違っていたら修正してください）`;
    } else {
      statusEl.textContent = '数字を読み取れませんでした。手動で入力してください。';
    }
  } catch (err) {
    console.error('OCR Error:', err);
    statusEl.textContent = '読み取りに失敗しました。手動で入力してください。';
  }
}

function handleConfirm(overlay) {
  const m = WEIGHT_METRICS[currentMetricIndex];
  const input = overlay.querySelector('#weightOcrValueInput');
  const val = input.value.trim();
  if (!val) {
    alert('数値を入力してください。');
    return;
  }
  weightReadings[m.key] = val;
  renderChips(overlay);
  renderWeightRecordSummary();
}

function closeWeightRecordModal() {
  const overlay = document.getElementById('weightOcrOverlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }
}

async function openWeightRecordModal() {
  closeWeightRecordModal();
  currentMetricIndex = 0;
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.className = 'tag-edit-overlay';
  overlay.id = 'weightOcrOverlay';
  overlay.innerHTML = `
    <div class="tag-edit-modal" style="width:100%; height:100dvh; max-width:none; border-radius:0; border:none; display:flex; flex-direction:column; padding:16px; box-sizing:border-box; background:#0a0f1e; overflow:hidden;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-shrink:0;">
        <h3 style="margin:0; color:#ffffff;">⚖️ 体重を記録する</h3>
        <button id="weightOcrCloseBtn" class="tag-edit-close" style="width:auto; padding:6px 14px; margin:0;">閉じる</button>
      </div>
      <div id="weightOcrTabs" style="display:flex; gap:6px; margin-bottom:10px; flex-shrink:0; flex-wrap:wrap;"></div>
      <div style="position:relative; flex:1; min-height:0; background:#000; border-radius:8px; overflow:hidden; display:flex; align-items:center; justify-content:center;">
        <video id="weightOcrVideo" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover;"></video>
        <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:70%; height:35%; border:2px dashed var(--accent-cyan); border-radius:8px; pointer-events:none;"></div>
        <canvas id="weightOcrCanvas" style="display:none;"></canvas>
      </div>
      <div id="weightOcrStatus" style="font-size:0.8rem; color:var(--text-muted); text-align:center; margin-top:8px; flex-shrink:0;">体重計の数字表示を枠に合わせて📸を押してください</div>
      <div style="display:flex; gap:10px; align-items:center; margin-top:10px; flex-shrink:0;">
        <span id="weightOcrCurrentLabel" style="font-size:0.85rem; color:var(--text-muted); white-space:nowrap;">体重</span>
        <input type="text" id="weightOcrValueInput" class="cyber-input" placeholder="数値" style="flex:1; margin:0;">
        <button id="weightOcrConfirmBtn" class="cyber-button" style="width:auto; padding:10px 14px; margin:0; white-space:nowrap;">確定</button>
      </div>
      <div id="weightOcrChips" style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; min-height:20px; flex-shrink:0;"></div>
      <div style="display:flex; gap:10px; margin-top:12px; flex-shrink:0; padding-bottom:max(env(safe-area-inset-bottom), 10px);">
        <button id="weightOcrShutterBtn" class="cyber-button" style="flex:1; padding:14px;">📸 撮影して読み取る</button>
        <button id="weightOcrDoneBtn" class="cyber-button" style="flex:1; padding:14px; background:rgba(16,185,129,0.2); border-color:#10b981; color:#6ee7b7;">完了</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  renderTabs(overlay);
  updateCurrentMetricUI(overlay);
  renderChips(overlay);

  const video = overlay.querySelector('#weightOcrVideo');
  const statusEl = overlay.querySelector('#weightOcrStatus');
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = currentStream;
    } catch (err) {
      console.error('Camera Error:', err);
      statusEl.textContent = 'カメラを起動できませんでした。数値は手動で入力できます。';
    }
  } else {
    statusEl.textContent = 'このブラウザ/環境ではカメラを利用できません。数値は手動で入力できます。';
  }

  overlay.querySelector('#weightOcrCloseBtn').addEventListener('click', closeWeightRecordModal);
  overlay.querySelector('#weightOcrShutterBtn').addEventListener('click', () => handleShutter(overlay));
  overlay.querySelector('#weightOcrConfirmBtn').addEventListener('click', () => handleConfirm(overlay));
  overlay.querySelector('#weightOcrDoneBtn').addEventListener('click', () => {
    commitReadingsToBody();
    closeWeightRecordModal();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeWeightRecordModal();
  });
}

// 日記保存が成功した後、記録済みの体重系サマリー表示をクリアするために google_api.js から呼ばれる
window.resetWeightRecordUI = function() {
  weightReadings = {};
  renderWeightRecordSummary();
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('weightRecordBtn');
  if (btn) btn.addEventListener('click', openWeightRecordModal);
});
