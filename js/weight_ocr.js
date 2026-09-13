// js/weight_ocr.js
// 体重系の記録（体重・体脂肪率・内臓脂肪レベル・BMI）を日記に記録する機能。
// カメラ撮影によるOCR自動読み取りは、実写真での検証で7セグメント表示の認識精度が
// 実用に耐えないと判断し廃止。シンプルな手入力フォームのみで記録する。

const WEIGHT_METRICS = [
  { key: 'weight', label: '体重', unit: 'kg' },
  { key: 'bodyFat', label: '体脂肪率', unit: '%' },
  { key: 'visceral', label: '内臓脂肪レベル', unit: '' },
  { key: 'bmi', label: 'BMI', unit: '' }
];

let weightReadings = {};

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

function closeWeightRecordModal() {
  const overlay = document.getElementById('weightOcrOverlay');
  if (overlay) overlay.remove();
  document.body.style.overflow = '';
}

function openWeightRecordModal() {
  closeWeightRecordModal();
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.className = 'tag-edit-overlay';
  overlay.id = 'weightOcrOverlay';
  overlay.innerHTML = `
    <div class="tag-edit-modal" style="width:90%; max-width:360px;">
      <h3 style="margin-top:0;">⚖️ 体重を記録する</h3>
      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px;">
        ${WEIGHT_METRICS.map(m => `
          <label style="display:flex; align-items:center; gap:8px;">
            <span style="width:100px; flex-shrink:0; font-size:0.85rem; color:var(--text-muted);">${m.label}</span>
            <input type="text" inputmode="decimal" class="cyber-input" id="weightInput_${m.key}"
              value="${weightReadings[m.key] || ''}" placeholder="数値" style="flex:1; margin:0;">
            ${m.unit ? `<span style="font-size:0.8rem; color:var(--text-muted); width:20px;">${m.unit}</span>` : '<span style="width:20px;"></span>'}
          </label>
        `).join('')}
      </div>
      <div style="display:flex; gap:10px;">
        <button id="weightOcrSaveBtn" class="cyber-button" style="flex:1; padding:12px; background:rgba(16,185,129,0.2); border-color:#10b981; color:#6ee7b7;">保存</button>
        <button id="weightOcrCloseBtn" class="tag-edit-close" style="flex:1; margin:0; padding:12px;">キャンセル</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#weightOcrCloseBtn').addEventListener('click', closeWeightRecordModal);
  overlay.querySelector('#weightOcrSaveBtn').addEventListener('click', () => {
    WEIGHT_METRICS.forEach(m => {
      const val = overlay.querySelector(`#weightInput_${m.key}`).value.trim();
      if (val) {
        weightReadings[m.key] = val;
      } else {
        delete weightReadings[m.key];
      }
    });
    commitReadingsToBody();
    renderWeightRecordSummary();
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
