// ============================================
// Dragon Diary - Main JS
// ホーム画面のインタラクション
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  initDragonParticles();
  initDragonTap();
  initDragonDrag(); // ドラッグ機能を追加
  initRandomVideoActions(); // ランダム動画再生機能を追加
  initNavigation();
  initStatBarAnimation();
  initPlayerName();
  initDragonComments();
  initNotifications();
  initPowerGraphCanvas();
  initStatusCards();
  initRadarChart();
  initTestExpButton();
  initTodayDate();
  
  // 初期状態の表示を更新
  gainExp(0);
});

function initTodayDate() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[today.getDay()];

  const elMonth = document.getElementById('todayMonthDisplay');
  const elDay = document.getElementById('todayDayDisplay');
  const elWeekday = document.getElementById('todayWeekdayDisplay');
  
  if (elMonth) elMonth.textContent = `${month}月`;
  if (elDay) elDay.textContent = `${day}日`;
  if (elWeekday) elWeekday.textContent = `${weekday}曜日`;
}

// --- 成長システム（状態管理） ---
let playerLevel = 1;
// --- 実績解除通知 ---
window.showAchievementToast = function(title, icon) {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.top = '-100px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '9999';
  toast.style.transition = 'top 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  
  toast.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px; background: rgba(10, 15, 30, 0.95); border: 1px solid var(--accent-cyan); padding: 15px 25px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,240,255,0.4); color: white;">
      <img src="${icon}" style="width: 40px; height: 40px; object-fit: contain;">
      <div>
        <div style="font-size: 0.8rem; color: var(--accent-cyan); margin-bottom: 3px;">実績解除！</div>
        <div style="font-size: 1.1rem; font-weight: bold; letter-spacing: 0.05em;">${title}</div>
      </div>
    </div>
  `;
  document.body.appendChild(toast);

  // 表示アニメーション
  setTimeout(() => {
    toast.style.top = '30px';
  }, 100);

  // 非表示アニメーション
  setTimeout(() => {
    toast.style.top = '-100px';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
};

let currentExp = parseInt(localStorage.getItem('dragonDiaryExp')) || 0;

// バグで付与された膨大なEXPを1回だけリセットする処理
if (currentExp >= 5000 && !localStorage.getItem('expResetV13')) {
  currentExp = 0;
  localStorage.setItem('dragonDiaryExp', 0);
  localStorage.setItem('expResetV13', 'true');
}

// v14での実績リセット（過去の同期による全開放を直すため）
if (!localStorage.getItem('achieveResetV14')) {
  localStorage.removeItem('unlockedAchievements');
  localStorage.setItem('achieveResetV14', 'true');
}

let maxUnlockedStage = 0; // 最初は第1段階(卵)のみ解放
let currentStageIndex = 0; // 現在表示中のステージ
let isEvolving = false; // 進化アニメーション中かどうかのフラグ
const STAGE_THRESHOLDS = [0, 300, 1000, 3000, 8000, 20000, 50000];

// --- 称号システム（レベル連動） ---
const PLAYER_TITLES = [
  { minLevel: 1,  title: '見習い記録者' },
  { minLevel: 2,  title: '駆け出しの書記' },
  { minLevel: 3,  title: '竜卵の守り人' },
  { minLevel: 5,  title: '蒼穹の龍使い' },
  { minLevel: 7,  title: '魔導の書記官' },
  { minLevel: 10, title: '銀翼の年代記作家' },
  { minLevel: 15, title: '黄昏の竜騎士' },
  { minLevel: 20, title: '深淵の賢者' },
  { minLevel: 30, title: '星読みの大魔導士' },
  { minLevel: 50, title: '伝説の竜王' },
];

function updatePlayerTitle(level) {
  let title = PLAYER_TITLES[0].title;
  for (let i = PLAYER_TITLES.length - 1; i >= 0; i--) {
    if (level >= PLAYER_TITLES[i].minLevel) {
      title = PLAYER_TITLES[i].title;
      break;
    }
  }
  const el = document.getElementById('display-player-title');
  if (el) el.textContent = title;
}

// --- 6月1〜3日の遡及EXP初期化 ---
// 一度だけ実行し、過去の日記データからEXPを計算して付与する
window.retroGrantJuneExp = function() {
  if (localStorage.getItem('retroExpGrantedV47')) return; // 既に実行済み

  // allDiariesが読み込まれるまで待つ必要があるため、google_api.jsのsyncPlayerStats後に呼ばれる
  if (!window.allDiaries || window.allDiaries.length === 0) return;

  let totalRetroExp = 0;
  
  // 日付文字列(YYYY-MM-DD)を取得するヘルパー
  const getDateStr = (d) => {
    if (!d.start) return null;
    let dateObj = d.start.date || d.start.dateTime;
    if (!dateObj) return null;
    // タイムゾーンや文字列形式の差異を吸収するためDate型にして比較しやすい形にする
    const dt = new Date(dateObj);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const juneDates = ['2026-06-01', '2026-06-02', '2026-06-03'];
  
  // 日付順にソート（ストリーク計算のため）
  const juneEntries = window.allDiaries.filter(d => {
    const ds = getDateStr(d);
    return ds && juneDates.includes(ds);
  }).sort((a, b) => new Date(getDateStr(a)) - new Date(getDateStr(b)));

  // 各日付ごとに1件だけEXP計算（同一日に複数件あっても1回分）
  const processedDates = new Set();
  let streakCount = 0;

  juneEntries.forEach(diary => {
    const dateStr = getDateStr(diary);
    if (processedDates.has(dateStr)) return;
    processedDates.add(dateStr);
    streakCount++;

    let exp = 20; // 基本EXP
    const textLen = (diary.description || '').replace(/\s+/g, '').length;
    let textBonus = Math.floor(textLen / 100) * 10;
    if (textBonus > 200) textBonus = 200;
    exp += textBonus;

    // ストリークボーナス
    if (streakCount >= 100) exp += 300;
    else if (streakCount >= 30) exp += 100;
    else if (streakCount >= 14) exp += 50;
    else if (streakCount >= 7) exp += 30;
    else if (streakCount >= 3) exp += 10;

    totalRetroExp += exp;
  });

  if (totalRetroExp > 0) {
    // 現在のEXPに加算
    if (typeof gainExp === 'function') {
      gainExp(totalRetroExp);
    }
    localStorage.setItem('retroExpGrantedV47', 'true');
    console.log(`[遡及EXP] 6月1〜3日分: ${totalRetroExp} EXP を付与しました`);
    if (typeof window.showInAppNotification === 'function') {
      window.showInAppNotification('✨過去の記録を還元しました', `6月1日〜3日の日記から ${totalRetroExp} EXPを獲得しました！`);
    }
  } else {
    // 該当する日記が1件も見つからなかった場合
    console.log('[遡及EXP] 6月1〜3日の日記は見つかりませんでした。');
    localStorage.setItem('retroExpGrantedV47', 'true');
  }
};

function gainExp(amount) {
  if (isEvolving) return; // 進化中はEXP取得（連打）を無視する
  
  currentExp += amount;
  localStorage.setItem('dragonDiaryExp', currentExp); // 経験値をローカル保存
  // レベル1=0, レベル2=100, レベル3=300, レベル4=600 ...というように
  // L = 1/2 + sqrt(1/4 + 2 * exp / 100) を使って計算
  playerLevel = Math.floor((1 + Math.sqrt(1 + 8 * currentExp / 100)) / 2);
  
  const levelDisplay = document.getElementById('playerLevelDisplay');
  if (levelDisplay) levelDisplay.textContent = `プレイヤーレベル: ${playerLevel}`;
  updatePlayerTitle(playerLevel);
  const expDisplay = document.getElementById('powerValueDisplay');
  if (expDisplay) expDisplay.innerHTML = `${currentExp} <span style="font-size: 0.6em; color: var(--text-muted);">EXP</span>`;

  // 総合魔力の表示も更新
  const magicDisplay = document.getElementById('displayTotalMagic');
  if (magicDisplay) magicDisplay.textContent = currentExp;

  let newUnlockedStage = maxUnlockedStage;
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
    if (currentExp >= STAGE_THRESHOLDS[i]) {
      newUnlockedStage = i;
    }
  }

  // 進化基準に達した場合の強制イベント
  if (newUnlockedStage > maxUnlockedStage) {
    maxUnlockedStage = newUnlockedStage;
    triggerEvolution(newUnlockedStage);
  } else if (amount === 0) {
    // 初回ロード時の画像セット用
    currentStageIndex = maxUnlockedStage;
    const stage = DRAGON_STAGES[currentStageIndex];
    const img = document.getElementById('dragonImage');
    const nameEl = document.querySelector('.dragon-name');
    const stageEl = document.querySelector('.dragon-stage');
    if(img && stage) {
      img.src = stage.image;
      img.style.animation = `${stage.animation} 4s ease-in-out infinite`;
      nameEl.textContent = stage.name;
      stageEl.textContent = stage.stage;
      // 伝説の竜・古竜なら発光クラス付与
      img.classList.remove('legendary-glow', 'mature-glow');
      if (currentStageIndex === 5) {
        img.classList.add('mature-glow');
      } else if (currentStageIndex >= 6) {
        img.classList.add('legendary-glow');
      }
    }
  }

  // 炎画像のクリップ
  const flameImg = document.querySelector('.active-flame');
  if (flameImg) {
    let maxExp = 10000;
    while (currentExp >= maxExp) {
      maxExp += 5000;
    }
    const midLabel = document.getElementById('flameMidLabel');
    const maxLabel = document.getElementById('flameMaxLabel');
    if (midLabel && maxLabel) {
      midLabel.textContent = Math.floor(maxExp / 2);
      maxLabel.textContent = maxExp;
    }

    let progress = currentExp / maxExp;
    if (progress > 1) progress = 1;
    if (progress < 0) progress = 0;
    const percent = progress * 100;
    flameImg.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
  }

  // レーダーチャートの更新
  if (typeof window.updateRadarChart === 'function') {
    window.updateRadarChart(currentExp);
  }

  // プレイヤーレベルのサークルゲージ更新
  const circleGauge = document.querySelector('.circle-gauge');
  if (circleGauge) {
    const levelProgress = currentExp > 0 ? (currentExp % 5000) / 5000 * 100 : 0;
    circleGauge.style.background = `conic-gradient(var(--accent-cyan) ${levelProgress}%, rgba(255,255,255,0.1) 0)`;
  }
}

function triggerEvolution(targetStageIndex) {
  const container = document.getElementById('dragonContainer');
  if (!container) return;
  
  isEvolving = true; // 進化ロック
  
  // 進化を見せるために強制的に一番上へスクロール
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // 対象の段階に応じてエフェクトとタイミングを切り替える
  let effectClass = 'evolution-light';
  let switchDelay = 1000;
  let duration = 2000;
  
  const stormOverlay = document.getElementById('stormOverlay');
  const rainContainer = document.getElementById('rainContainer');
  const lightningFlash = document.getElementById('lightningFlash');
  const dragonArea = document.getElementById('dragonArea');
  
  let useStorm = false;
  let useLightning = false;

  if (targetStageIndex >= 6) {
    // 伝説の竜：黒雲、雨、激雷
    effectClass = 'evolution-storm';
    switchDelay = 1800;
    duration = 4500;
    useStorm = true;
    useLightning = true;
  } else if (targetStageIndex >= 5) {
    // 古竜：黄金オーラと激しい雷
    effectClass = 'evolution-golden-lightning';
    switchDelay = 1800;
    duration = 3500;
    useLightning = true;
  } else if (targetStageIndex >= 4) {
    // 青年竜：雷エフェクトと振動
    effectClass = 'evolution-lightning';
    switchDelay = 1250;
    duration = 2500;
    useLightning = true;
  } else if (targetStageIndex >= 3) {
    // 少年竜：強烈な光とオーラ
    effectClass = 'evolution-aura';
    switchDelay = 1250;
    duration = 2500;
  }
  
  if (useStorm) {
    if (stormOverlay) stormOverlay.classList.add('active');
    if (dragonArea) dragonArea.classList.add('bring-to-front');
    if (rainContainer) {
      rainContainer.classList.add('active');
      rainContainer.innerHTML = '';
      for (let i = 0; i < 40; i++) {
        const drop = document.createElement('div');
        drop.className = 'rain-drop';
        drop.style.left = `${Math.random() * 100}%`;
        drop.style.animationDuration = `${0.3 + Math.random() * 0.3}s`;
        drop.style.animationDelay = `${Math.random()}s`;
        rainContainer.appendChild(drop);
      }
    }
  }

  if (useLightning) {
    if (lightningFlash) {
      lightningFlash.classList.remove('active');
      void lightningFlash.offsetWidth; // リフロー
      lightningFlash.classList.add('active');
    }
    // 実際の稲妻（雷の形をした図形）を時間差で落とす
    for(let i=0; i<3; i++) {
      setTimeout(() => createLightningBolt(), i * 400 + Math.random() * 200);
    }
    if (targetStageIndex >= 6) { 
      // 伝説の竜は後半にもさらに雷を落とす
      for(let i=0; i<5; i++) {
        setTimeout(() => createLightningBolt(), 1500 + i * 300 + Math.random() * 200);
      }
    }
  }

  // 発光エフェクト付与
  container.classList.add(effectClass);
  
  // 時間差でパーティクルを発生
  spawnTapParticles(container);
  setTimeout(() => spawnTapParticles(container), 200);
  setTimeout(() => spawnTapParticles(container), 400);
  setTimeout(() => spawnTapParticles(container), 600);
  if (targetStageIndex >= 3) setTimeout(() => spawnTapParticles(container), 800);
  if (targetStageIndex >= 5) setTimeout(() => spawnTapParticles(container), 1000);

  // 光が最も強いタイミングで新しい姿に切り替える
  setTimeout(() => {
    currentStageIndex = targetStageIndex;
    const stage = DRAGON_STAGES[currentStageIndex];
    const img = document.getElementById('dragonImage');
    const nameEl = document.querySelector('.dragon-name');
    const stageEl = document.querySelector('.dragon-stage');
    
    img.src = stage.image;
    img.style.animation = `${stage.animation} 4s ease-in-out infinite`;
    nameEl.textContent = stage.name;
    stageEl.textContent = stage.stage;
    
    // 伝説の竜・古竜なら発光クラス付与
    img.classList.remove('legendary-glow', 'mature-glow');
    if (currentStageIndex === 5) {
      img.classList.add('mature-glow');
    } else if (currentStageIndex >= 6) {
      img.classList.add('legendary-glow');
    }
  }, switchDelay);

  // エフェクト終了
  setTimeout(() => {
    container.classList.remove(effectClass);
    if (useStorm) {
      if (stormOverlay) stormOverlay.classList.remove('active');
      if (rainContainer) rainContainer.classList.remove('active');
      if (dragonArea) dragonArea.classList.remove('bring-to-front');
    }
    isEvolving = false; // 進化ロック解除
  }, duration);
}

// 実際の稲妻（雷）のSVGを画面に生成する関数
function createLightningBolt() {
  const container = document.getElementById('lightningFlash');
  if (!container) return;
  const bolt = document.createElement('div');
  bolt.className = 'real-lightning-bolt';
  bolt.style.left = `${Math.random() * 80 + 10}%`;
  bolt.style.top = `-10%`;
  
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 500");
  svg.style.width = "80px";
  svg.style.height = "100vh";
  svg.style.filter = "drop-shadow(0 0 10px #fff) drop-shadow(0 0 20px #0ff)";
  
  const polygon = document.createElementNS(svgNS, "polygon");
  // 稲妻のギザギザを描画
  polygon.setAttribute("points", "50,0 20,150 45,150 15,300 40,300 0,500 80,250 40,250 70,100 40,100");
  polygon.setAttribute("fill", "white");
  
  svg.appendChild(polygon);
  bolt.appendChild(svg);
  container.appendChild(bolt);
  
  setTimeout(() => {
    bolt.remove();
  }, 400);
}

function initTestExpButton() {
  const btn = document.getElementById('testExpButton');
  if (btn) {
    btn.addEventListener('click', () => {
      gainExp(5000); // 1回押すたびに5000EXP（1段階分）獲得
    });
  }
}

// --- ドラゴンのパーティクルエフェクト ---
function initDragonParticles() {
  const container = document.getElementById('dragonParticles');
  if (!container) return;

  const PARTICLE_COUNT = 8;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';

    // ランダムな位置と遅延
    const x = 30 + Math.random() * 40; // 中央付近に集中
    const y = 40 + Math.random() * 30;
    const delay = Math.random() * 3;
    const duration = 2 + Math.random() * 2;
    const size = 2 + Math.random() * 3;

    // 色のバリエーション
    const colors = [
      'rgba(139, 92, 246, 0.8)',   // violet
      'rgba(74, 125, 255, 0.8)',   // blue
      'rgba(34, 211, 238, 0.6)',   // cyan
      'rgba(255, 255, 255, 0.4)',  // white
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    particle.style.cssText = `
      left: ${x}%;
      top: ${y}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      animation-delay: ${delay}s;
      animation-duration: ${duration}s;
      box-shadow: 0 0 ${size * 2}px ${color};
    `;

    container.appendChild(particle);
  }
}

// --- ドラゴンをタップした時のリアクション ---
function initDragonTap() {
  const dragonContainer = document.getElementById('dragonContainer');
  const dragonImage = document.getElementById('dragonImage');
  if (!dragonContainer || !dragonImage) return;

  dragonContainer.addEventListener('click', () => {
    if (currentStageIndex === 0 || currentStageIndex === 1) {
      // 卵の段階（第1、第2段階）は横に揺れる
      dragonImage.animate([
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(15deg)', offset: 0.25 },
        { transform: 'rotate(-15deg)', offset: 0.5 },
        { transform: 'rotate(8deg)', offset: 0.75 },
        { transform: 'rotate(0deg)' }
      ], {
        duration: 400,
        easing: 'ease-in-out'
      });
    } else {
      // ドラゴンになったらバウンスする
      dragonImage.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(0.9) translateY(10px)', offset: 0.4 },
        { transform: 'scale(1.05) translateY(-5px)', offset: 0.7 },
        { transform: 'scale(1)' }
      ], {
        duration: 500,
        easing: 'ease-out'
      });
    }

    // タップ回数を記録して愛情をアップさせる
    let taps = parseInt(localStorage.getItem('dragonTapCount') || '0', 10);
    taps++;
    localStorage.setItem('dragonTapCount', taps);
    
    // レーダーチャートを即座に更新する
    if (typeof window.updateRadarChart === 'function') {
      window.updateRadarChart(currentExp);
    }

    // タップ時にパーティクルを一時的に増やす
    if (typeof spawnTapParticles === 'function') {
      spawnTapParticles(dragonContainer);
    }
  });
}

// タップ時の一時パーティクル
function spawnTapParticles(container) {
  const rect = container.getBoundingClientRect();

  for (let i = 0; i < 6; i++) {
    const spark = document.createElement('div');
    spark.className = 'tap-spark';

    const angle = (Math.PI * 2 * i) / 6;
    const distance = 40 + Math.random() * 30;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    spark.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      width: 4px;
      height: 4px;
      background: rgba(34, 211, 238, 0.9);
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(34, 211, 238, 0.6);
      pointer-events: none;
      z-index: 10;
      transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      opacity: 1;
    `;

    container.appendChild(spark);

    // アニメーション発火
    requestAnimationFrame(() => {
      spark.style.transform = `translate(${x}px, ${y}px) scale(0)`;
      spark.style.opacity = '0';
    });

    // 後片付け
    setTimeout(() => spark.remove(), 600);
  }
}

// CSS でタップアニメーションを追加
const tapStyle = document.createElement('style');
tapStyle.textContent = `
  @keyframes dragonTap {
    0%   { transform: scale(1); }
    15%  { transform: scale(0.9); }
    30%  { transform: scale(1.1) translateY(-8px); }
    50%  { transform: scale(1.05) translateY(-4px); }
    70%  { transform: scale(1.02) translateY(-2px); }
    100% { transform: scale(1) translateY(0); }
  }
  .dragon-dragging {
    animation: none !important;
    transition: none !important;
    transform: scale(1.1) !important;
    filter: drop-shadow(0 20px 25px rgba(139, 92, 246, 0.5)) !important;
    z-index: 1000;
  }
  .dragon-snap-back {
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
  }
`;
document.head.appendChild(tapStyle);

// --- ドラゴンのドラッグ（引っ張る）機能 ---
function initDragonDrag() {
  const container = document.getElementById('dragonContainer');
  if (!container) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let currentX = 0, currentY = 0;

  const startDrag = (e) => {
    isDragging = true;
    container.classList.add('dragon-dragging');
    container.classList.remove('dragon-snap-back');

    // タッチかマウスか判定
    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    startX = clientX - currentX;
    startY = clientY - currentY;

    // デフォルトの画像ドラッグを防止
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
    }
  };

  const moveDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault(); // スクロール防止

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    currentX = clientX - startX;
    currentY = clientY - startY;

    // ドラゴンを指に追従させる
    container.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.1)`;
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;

    container.classList.remove('dragon-dragging');
    container.classList.add('dragon-snap-back');

    // 元の位置に戻す
    currentX = 0;
    currentY = 0;
    container.style.transform = '';

    // アニメーションを再開させるために少し待つ
    setTimeout(() => {
      container.classList.remove('dragon-snap-back');
    }, 500);
  };

  // マウスイベント
  container.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', moveDrag);
  window.addEventListener('mouseup', endDrag);

  // タッチイベント
  container.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', moveDrag, { passive: false });
  window.addEventListener('touchend', endDrag);
}

// --- ドラゴンのランダム動画再生機能 ---
function initRandomVideoActions() {
  const dragonImage = document.getElementById('dragonImage');
  const dragonVideo = document.getElementById('dragonVideo');
  if (!dragonImage || !dragonVideo) return;

  // 幼竜の動画パターン
  const hatchlingVideos = [
    'assets/dragons/videos/hatchling_action1.mp4',
    'assets/dragons/videos/hatchling_action2.mp4',
    'assets/dragons/videos/hatchling_action3.mp4'
  ];

  // 少年竜の動画パターン
  const youngVideos = [
    'assets/dragons/videos/young_action1.mp4',
    'assets/dragons/videos/young_action2.mp4',
    'assets/dragons/videos/young_action3.mp4',
    'assets/dragons/videos/young_action4.mp4'
  ];

  // 青年竜の動画パターン
  const juvenileVideos = [
    'assets/dragons/videos/juvenile_action1.mp4'
  ];

  // 古竜の動画パターン
  const matureVideos = [
    'assets/dragons/videos/mature_action1.mp4'
  ];

  // 伝説の竜の動画パターン
  const legendaryVideos = [
    'assets/dragons/videos/legendary_action1.mp4',
    'assets/dragons/videos/legendary_action2.mp4'
  ];

  let actionTimer;

  const playRandomAction = () => {
    let videoPatterns = [];

    // 現在の姿に合わせて再生する動画リストを決める
    if (dragonImage.src.includes('stage3_hatchling')) {
      videoPatterns = hatchlingVideos;
    } else if (dragonImage.src.includes('stage4_young')) {
      videoPatterns = youngVideos;
    } else if (dragonImage.src.includes('stage5_juvenile')) {
      videoPatterns = juvenileVideos;
    } else if (dragonImage.src.includes('stage6_mature')) {
      videoPatterns = matureVideos;
    } else if (dragonImage.src.includes('stage7_legendary')) {
      videoPatterns = legendaryVideos;
    } else {
      // 幼竜・少年竜・青年竜・古竜・伝説の竜以外はスキップ
      scheduleNextAction();
      return;
    }

    // ランダムな動画を選択
    const randomVideo = videoPatterns[Math.floor(Math.random() * videoPatterns.length)];
    
    // 動画のロードと再生準備
    dragonVideo.src = randomVideo;
    dragonVideo.load();
    
    dragonVideo.onloadeddata = () => {
      const container = document.querySelector('.dragon-container');
      container.classList.add('flash-active');

      // 光が最も強くなるタイミング（400ms後）で切り替える
      setTimeout(() => {
        dragonImage.style.opacity = '0';
        dragonVideo.style.opacity = '1';
        dragonVideo.play().catch(e => {
          // 自動再生がブラウザにブロックされた場合は元に戻す
          console.warn('Video auto-play prevented', e);
          resetToImage();
        });
      }, 400);

      // アニメーション終了後にクラスを外す
      setTimeout(() => {
        container.classList.remove('flash-active');
      }, 800);
    };
  };

  const resetToImage = () => {
    const dragonVideo = document.getElementById('dragonVideo');
    const dragonImage = document.getElementById('dragonImage');
    const container = document.querySelector('.dragon-container');
    if (!dragonVideo || !dragonImage || !container) return;

    container.classList.add('flash-active');
    
    setTimeout(() => {
      dragonImage.style.opacity = '1';
      dragonVideo.style.opacity = '0';
    }, 400);

    setTimeout(() => {
      container.classList.remove('flash-active');
      // タイマーはinitRandomVideoActions側で再設定される
    }, 800);
  };

  const scheduleNextAction = () => {
    // 5秒〜15秒のランダムな時間で次の動画再生を予約
    const randomDelay = Math.floor(Math.random() * 10000) + 5000;
    clearTimeout(actionTimer);
    actionTimer = setTimeout(playRandomAction, randomDelay);
  };

  // 動画再生終了時のイベント
  dragonVideo.addEventListener('ended', resetToImage);

  // 初回のタイマーをセット
  scheduleNextAction();
}

// --- ナビゲーションと画面切り替え ---
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view-section');

  function switchView(targetId) {
    views.forEach(view => {
      view.style.display = 'none';
      view.classList.remove('active');
    });
    const targetView = document.getElementById(targetId);
    if (targetView) {
      targetView.style.display = 'block';
      // 少し遅らせてアニメーションクラスをつける
      setTimeout(() => targetView.classList.add('active'), 10);
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const page = item.getAttribute('data-page');
      switchView(`view-${page}`);
    });
  });

  // 日記を書くボタン
  const writeBtn = document.getElementById('writeButton');
  if (writeBtn) {
    writeBtn.addEventListener('click', () => {
      switchView('view-write');
    });
  }

  // 日記作成から戻るボタン
  const backBtn = document.getElementById('backFromWrite');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      switchView('view-home');
      // ホームタブをアクティブに戻す
      navItems.forEach(n => n.classList.remove('active'));
      document.querySelector('.nav-item[data-page="home"]').classList.add('active');
    });
  }
}

// --- ステータスバーのアニメーション ---
function initStatBarAnimation() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const bars = entry.target.querySelectorAll('.stat-bar-fill');
        bars.forEach((bar, index) => {
          const targetWidth = bar.style.width;
          bar.style.width = '0%';
          setTimeout(() => {
            bar.style.width = targetWidth;
          }, 100 + index * 150);
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  const statsGrid = document.querySelector('.stats-grid');
  if (statsGrid) observer.observe(statsGrid);
}

// --- ドラゴンの段階を切り替える（デモ用） ---
const DRAGON_STAGES = [
  { image: 'assets/dragons/stage1_egg.png',       name: '神秘の卵',   stage: '第1段階', animation: 'eggIdle' },
  { image: 'assets/dragons/stage2_egg.png',        name: '覚醒の卵',   stage: '第2段階', animation: 'eggWobble' },
  { image: 'assets/dragons/stage3_hatchling.png',  name: '幼竜',      stage: '第3段階', animation: 'dragonBreathing' },
  { image: 'assets/dragons/stage4_young.png',      name: '少年竜',    stage: '第4段階', animation: 'dragonBreathing' },
  { image: 'assets/dragons/stage5_juvenile.png',   name: '青年竜',    stage: '第5段階', animation: 'dragonFloat' },
  { image: 'assets/dragons/stage6_mature.png',     name: '古竜',      stage: '第6段階', animation: 'dragonFloat' },
  { image: 'assets/dragons/stage7_legendary.png',  name: '伝説の竜',  stage: '第7段階', animation: 'dragonFloat' },
];

// 卵専用アニメーション
const eggStyles = document.createElement('style');
eggStyles.textContent = `
  @keyframes eggIdle {
    0%, 100% {
      transform: scale(1);
      filter: drop-shadow(0 0 15px rgba(139, 92, 246, 0.3));
    }
    50% {
      transform: scale(1.01);
      filter: drop-shadow(0 0 25px rgba(139, 92, 246, 0.5));
    }
  }

  @keyframes eggWobble {
    0%, 80%, 100% {
      transform: rotate(0deg) scale(1);
      filter: drop-shadow(0 0 15px rgba(139, 92, 246, 0.3));
    }
    85% {
      transform: rotate(-3deg) scale(1.02);
      filter: drop-shadow(0 0 25px rgba(74, 125, 255, 0.6));
    }
    90% {
      transform: rotate(3deg) scale(1.02);
      filter: drop-shadow(0 0 25px rgba(74, 125, 255, 0.6));
    }
    95% {
      transform: rotate(-1.5deg) scale(1.01);
      filter: drop-shadow(0 0 20px rgba(139, 92, 246, 0.5));
    }
  }
`;
document.head.appendChild(eggStyles);


// ダブルタップで解放済みの過去の姿に切り替え
let lastTapTime = 0;

document.getElementById('dragonContainer')?.addEventListener('click', (e) => {
  const now = Date.now();
  if (now - lastTapTime < 300) {
    // ダブルタップ検出 → 次のステージへ (解放済みの範囲内でのみループ)
    if (maxUnlockedStage === 0) return; // 卵一つしかない場合は切り替えない
    
    currentStageIndex = (currentStageIndex + 1) % (maxUnlockedStage + 1);
    const stage = DRAGON_STAGES[currentStageIndex];

    const img = document.getElementById('dragonImage');
    const nameEl = document.querySelector('.dragon-name');
    const stageEl = document.querySelector('.dragon-stage');

    // フェードアウト → 切り替え → フェードイン
    img.style.transition = 'opacity 0.3s ease';
    img.style.opacity = '0';

    setTimeout(() => {
      img.src = stage.image;
      img.style.animation = `${stage.animation} 4s ease-in-out infinite`;
      nameEl.textContent = stage.name;
      stageEl.textContent = stage.stage;
      
      // 伝説の竜・古竜なら発光クラス付与
      img.classList.remove('legendary-glow', 'mature-glow');
      if (currentStageIndex === 5) {
        img.classList.add('mature-glow');
      } else if (currentStageIndex >= 6) {
        img.classList.add('legendary-glow');
      }

      img.style.opacity = '1';
    }, 300);
  } else {
    // シングルタップ（またはダブルタップの1回目）時のエフェクト
    if (currentStageIndex <= 1) {
      const ripple = document.createElement('div');
      ripple.className = 'mystic-ripple';
      // コンテナ内の画像の背後に配置するため、先頭に追加するかCSSのz-indexで調整(z-index:-1にしてある)
      document.getElementById('dragonContainer').appendChild(ripple);
      setTimeout(() => {
        ripple.remove();
      }, 1200);
    }
  }
  lastTapTime = now;

  // タップ回数を保存（ステータスの「愛情」パラメーターに影響）
  let taps = parseInt(localStorage.getItem('dragonTapCount') || '0', 10);
  localStorage.setItem('dragonTapCount', taps + 1);

  // レーダーチャートをリアルタイム反映
  if (typeof window.updateRadarChart === 'function') {
    window.updateRadarChart(typeof currentExp !== 'undefined' ? currentExp : 0);
  }
});


// --- プレイヤー名の設定とローカルストレージ ---
function initPlayerName() {
  const modal = document.getElementById('player-setup-modal');
  const input = document.getElementById('player-name-input');
  const submitBtn = document.getElementById('player-name-submit');
  const displayName = document.getElementById('display-player-name');

  if (!modal || !input || !submitBtn || !displayName) return;

  let savedName = localStorage.getItem('dragonDiaryPlayerName');
  if (savedName) {
    displayName.textContent = savedName;
    modal.classList.add('hidden');
  } else {
    modal.classList.remove('hidden');
  }

  submitBtn.addEventListener('click', () => {
    const name = input.value.trim();
    if (name) {
      localStorage.setItem('dragonDiaryPlayerName', name);
      displayName.textContent = name;
      modal.classList.add('hidden');
    }
  });
}

// --- ドラゴンからのコメント生成（EXPベースで自動表示） ---
function initDragonComments() {
  // ステージごとのコメント（複数パターン）
  const commentsByStage = {
    0: [
      "ピィ...ピィ... (たくさんの魔力が流れ込んできて、卵が暖かそうだ)",
      "コト...コト... (毎日魔力が注がれ、中で生命が育っている)",
      "ピィ... (あなたの感情の揺らぎに反応して、卵が小さく光った)",
      "コトッ！ (新しい魔力の刺激に驚いたように揺れた)",
      "（卵がほんのり温かい。日記を書くと、さらに光が強くなる気がする…）"
    ],
    1: [
      "ピィッ！ (たっぷりの魔力をもらって、殻にヒビが入った！)",
      "ピィー！ (毎日の記録のおかげで、もうすぐ生まれそうだ！)",
      "ピピィ... (あなたの強い思いを受け取り、熱を帯びている)",
      "ピッ！ (未知の魔力に刺激され、少し殻が割れた！)",
      "（殻の隙間から小さな目がこちらを覗いている…！）"
    ],
    2: [
      "キュルル！ (あなたがたくさん書いた日記を、嬉しそうに読んでいる！)",
      "クウ... (毎日あなたに会えるのが嬉しいようだ)",
      "キュン... (あなたが乗り越えた苦労を感じ取り、寄り添ってくれている)",
      "キャッ！ (新しい出来事を知って、目を輝かせている！)",
      "キュルキュル♪ (あなたのそばでご機嫌に尻尾を振っている)"
    ],
    3: [
      "ギャオ！ (詳細な記録から、強い魔力を吸収して喜んでいる！)",
      "グルル... (毎日の継続が力になっている。頼もしそうにあなたを見ている)",
      "ギャウ！ (辛いことを乗り越えたあなたを、力強く励ましている！)",
      "ガウッ！ (あなたと共に新しい世界を知り、興奮しているようだ！)",
      "グルルゥ... (翼を広げ、あなたを守るように寄り添っている)"
    ],
    4: [
      "ガァァ！ (その詳細な記録は素晴らしい。我が力となる！と言っているようだ)",
      "フン... (今日も続けるとはな。お前の根気を認めてやろう、という顔だ)",
      "グルルォ... (その苦難を越えたお前は強い。私がついているぞ、と励ましている)",
      "ガァッ！ (その探求心こそが我らを強くするのだ！)",
      "（炎を静かに吐き、あなたの道を照らしている）"
    ],
    5: [
      "グルルォォ！ (見事な記録だ。お前の歩みは確実に力となっている)",
      "（静かに頷き、あなたの毎日の継続を心から讃えている）",
      "（優しく寄り添い、あなたの心の成長を誇りに思っているようだ）",
      "グルォ... (その好奇心、忘れるでないぞ。共に歩もう)",
      "（巨大な翼であなたを包み込み、深い信頼を示している）"
    ],
    6: [
      "「我が主よ、これほどの詳細な記録、見事な魔力の奔流だ。大儀である。」",
      "「日々の積み重ねこそが最強の魔法。そなたの継続、誇りに思うぞ。」",
      "「その苦難を越え、さらに強くなったな。我が主よ、私はいつでもそなたと共にある。」",
      "「ほう、また新たな知識を得たか。そなたの歩む道、我も共に楽しもうぞ。」",
      "「我とそなたの絆は永遠だ。共にこの先も歩もうではないか。」"
    ]
  };

  // コメント画面のDragonステージ名
  const stageNames = ['神秘の卵', '覚醒の卵', '幼竜', '若竜', '飛竜', '古竜', '伝説の竜'];

  const navItems = document.querySelectorAll('.nav-item');
  const commentBox = document.getElementById('dragonCommentBox');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      if (page === 'stats') {
        // 現在のEXPに基づくステージを算出
        const exp = parseInt(localStorage.getItem('dragonDiaryExp')) || 0;
        let stageIdx = 0;
        for (let i = 0; i < STAGE_THRESHOLDS.length; i++) {
          if (exp >= STAGE_THRESHOLDS[i]) stageIdx = i;
        }
        const comments = commentsByStage[stageIdx] || commentsByStage[0];
        const dragonWord = comments[Math.floor(Math.random() * comments.length)];
        const stageName = stageNames[stageIdx] || '???';
        
        if (commentBox) {
          commentBox.innerHTML = `
            <div style="  margin-top: 5px; text-align: center; font-family: var(--font-display); color: var(--accent-gold); font-size: 0.85rem;">
              🐉 ${stageName} ─ 総魔力: ${exp} EXP
            </div>
            <p class="accent-cyan" style="font-size:1.05rem; text-align:center; line-height: 1.6;">
              ${dragonWord}
            </p>
          `;
        }
      }
    });
  });
}

// --- 炎の上の火の粉エフェクト (Canvas) ---
function initPowerGraphCanvas() {
  try {
    const canvas = document.getElementById('powerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const w = canvas.offsetWidth || canvas.parentElement.clientWidth || 300;
      const h = canvas.offsetHeight || 140;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
    };
    
    window.addEventListener('resize', resize);
    resize();

    let time = 0;
    const particles = [];
    
    for(let i=0; i<40; i++) {
      particles.push({
        x: Math.random() * (canvas.width || 300),
        y: Math.random() * (canvas.height || 140),
        size: Math.random() * 1.5 + 1,
        speedY: Math.random() * 1.5 + 0.5,
        speedX: (Math.random() - 0.5) * 1.5,
        opacity: Math.random()
      });
    }

    function animate() {
      resize();
      if (canvas.width === 0 || canvas.height === 0) {
        requestAnimationFrame(animate);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      time += 0.03;

      const activeWidth = canvas.width * 0.85;

      let maxExp = 10000;
      while (currentExp >= maxExp) {
        maxExp += 5000;
      }

      ctx.globalCompositeOperation = 'lighter';
      particles.forEach(p => {
        // 風に流されるような動き
        p.y -= p.speedY + Math.random() * 0.5;
        p.x += p.speedX + Math.sin(time * 2 + p.y * 0.05) * 1.5;
        p.opacity -= 0.008;
        
        if(p.y < 0 || p.opacity <= 0) {
          p.x = Math.random() * (canvas.width * (Math.min(currentExp, maxExp) / maxExp) || 10);
          p.opacity = Math.random() * 0.6 + 0.4;
          // 新しく生まれるときに速度をリセット
          p.speedY = Math.random() * 2 + 0.5;
          p.speedX = (Math.random() - 0.5) * 2;
        }
        
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 1.5, Math.PI / 6, 0, Math.PI * 2);
        
        // 画像の炎に合わせて、火の粉はオレンジ〜黄色にする
        ctx.fillStyle = `rgba(255, 180, 50, ${p.opacity})`;
        ctx.fill();
        
        // ほのかに光るグロー効果
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(255, 120, 0, 1)';
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 現在値の縦線 (7850などの固定値から動的値へ)
      let progress = currentExp / maxExp;
      if (progress > 1) progress = 1;
      if (progress < 0) progress = 0;
      const dynActiveWidth = canvas.width * progress;

      if (progress > 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.moveTo(dynActiveWidth, canvas.height);
        ctx.lineTo(dynActiveWidth, canvas.height * 0.25);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f0ff';
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      requestAnimationFrame(animate);
    }

    animate();
  } catch (err) {
    console.error(err);
  }
}

// --- ステータスカードのシャッフル切り替え処理 ---
function initStatusCards() {
  const stack = document.getElementById('statusCardStack');
  if (!stack) return;

  stack.addEventListener('click', () => {
    // 長押し処理の直後はシャッフルを防止する
    if (window.isLongPressFired) {
      window.isLongPressFired = false;
      return;
    }

    const cards = [
      document.querySelector('.status-card[data-position="front"]'),
      document.querySelector('.status-card[data-position="middle"]'),
      document.querySelector('.status-card[data-position="back"]')
    ];

    if (!cards[0] || !cards[1] || !cards[2]) return;

    // backのカードにアニメーション用のクラスを付与
    const backCard = cards[2];
    backCard.classList.add('shuffle-front');

    // frontはmiddleへ、middleはbackへ
    cards[0].dataset.position = 'middle';
    cards[1].dataset.position = 'back';
    
    // アニメーション完了後にbackの要素をfrontにし、クラスを外す
    setTimeout(() => {
      backCard.classList.remove('shuffle-front');
      backCard.dataset.position = 'front';
    }, 700);
  });
}

// --- レーダーチャートの描画 ---
function initRadarChart() {
  window.updateRadarChart = function(exp) {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    
    // Resize & reset
    const cssSize = 150;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssSize, cssSize);

    const center = cssSize / 2;
    const radius = cssSize / 2 - 25;

    // 実際の行動データに基づいてパラメーターを算出
    let vConsistency = 0, vExpressiveness = 0, vAffection = 0, vExploration = 0, vMagic = 0, vLuck = 0;

    const diaries = window.allDiaries || [];

    // 1. 継続力: ストリーク (30日でMax)
    const streakText = document.getElementById('todayStreakDisplay')?.textContent || '0';
    let streak = parseInt(streakText, 10) || 0;
    // ご要望により4日で計算（実際のストリークが4未満の場合は4として扱う）
    if (streak < 4) streak = 4;
    vConsistency = Math.min(streak / 30, 1.0);

    // 2. 表現力: 平均文字数 300文字からスタート
    let totalLen = 0;
    diaries.forEach(d => {
      totalLen += (d.description || '').replace(/\s+/g, '').length;
    });
    let avgLen = diaries.length > 0 ? (totalLen / diaries.length) : 0;
      if (avgLen < 300) avgLen = 300;
      // 500文字でMaxとする
      vExpressiveness = Math.min(avgLen / 500, 1.0);

      // 3. 愛情: 日記詳細閲覧 + ドラゴンタップ
      const views = parseInt(localStorage.getItem('diaryViewCount') || '0', 10);
      const taps = parseInt(localStorage.getItem('dragonTapCount') || '0', 10);
      vAffection = Math.min((views * 1 + taps * 5.0) / 50, 1.0);

      // 4. 探索: 現在0
      vExploration = 0;

      // 5. 魔力: 経験値(exp)で計算 (ご要望により現在のEXPを利用、上限を調整)
      // 魔力は1000EXPでMaxにする
      vMagic = Math.min(exp / 1000, 1.0);

    // 6. 幸運: 1日ごとのランダム値 (0.3〜1.0)
    const todayStr = typeof window.getVirtualTodayStr === 'function' ? window.getVirtualTodayStr() : new Date().toDateString();
    let storedLuckDate = localStorage.getItem('luckDate');
    let luckVal = parseFloat(localStorage.getItem('todayLuck') || '0');
    if (storedLuckDate !== todayStr || isNaN(luckVal) || luckVal === 0) {
      luckVal = 0.3 + Math.random() * 0.7;
      localStorage.setItem('luckDate', todayStr);
      localStorage.setItem('todayLuck', luckVal);
    }
    vLuck = luckVal;

    let data = [vConsistency, vExpressiveness, vAffection, vExploration, vMagic, vLuck];
    if (exp === 0 && (!window.allDiaries || window.allDiaries.length === 0)) data = [0,0,0,0,0,0];

    const labels = ['継続力', '表現力', '愛情', '探索', '魔力', '幸運'];

    function drawPolygon(r, color, isFill) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      if (isFill) {
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // レーダーの目盛り
    drawPolygon(radius, 'rgba(255, 255, 255, 0.1)', false);
    drawPolygon(radius * 0.66, 'rgba(255, 255, 255, 0.1)', false);
    drawPolygon(radius * 0.33, 'rgba(255, 255, 255, 0.1)', false);

    // 軸線
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      ctx.moveTo(center, center);
      ctx.lineTo(center + radius * Math.cos(angle), center + radius * Math.sin(angle));
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.stroke();

    // データの描画
    if (exp > 0) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const valRadius = radius * data[i];
        const x = center + valRadius * Math.cos(angle);
        const y = center + valRadius * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // ラベルの描画
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const textRadius = radius + 14;
      const x = center + textRadius * Math.cos(angle);
      const y = center + textRadius * Math.sin(angle);
      ctx.fillText(labels[i], x, y);
    }
  };

  // 初回描画
  if (typeof currentExp !== 'undefined') {
    window.updateRadarChart(currentExp);
  } else {
    window.updateRadarChart(0);
  }
}

// --- Notifications (アプリ内バナー通知) ---
function initNotifications() {
  const toggle = document.getElementById('reminderToggle');
  const timeInput = document.getElementById('reminderTime');
  
  if (!toggle || !timeInput) return;

  toggle.checked = localStorage.getItem('reminderEnabled') === 'true';
  timeInput.value = localStorage.getItem('reminderTime') || '21:00';

  toggle.addEventListener('change', (e) => {
    localStorage.setItem('reminderEnabled', e.target.checked);
    if (e.target.checked) {
      showInAppNotification('✅ リマインダーをONにしました！', `毎日 ${timeInput.value} に通知します`);
    }
  });

  timeInput.addEventListener('change', (e) => {
    localStorage.setItem('reminderTime', e.target.value);
    if (toggle.checked) {
      showInAppNotification('⏰ 通知時間を変更しました', `毎日 ${e.target.value} に通知します`);
    }
  });

  // 30秒ごとにチェック
  setInterval(() => {
    if (localStorage.getItem('reminderEnabled') === 'true') {
      const targetTime = localStorage.getItem('reminderTime') || '21:00';
      const now = new Date();
      const currentHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const todayKey = `notified_${now.getFullYear()}_${now.getMonth()}_${now.getDate()}`;
      
      if (currentHM === targetTime && !localStorage.getItem(todayKey)) {
        localStorage.setItem(todayKey, 'true');
        showInAppNotification('🐉 竜の日記', '今日の日記を書く時間です！ドラゴンがあなたを待っています。');
      }
    }
  }, 30000);
}

// アプリ内バナー通知
function showInAppNotification(title, body) {
  // 既存の通知があれば削除
  document.querySelectorAll('.in-app-notification').forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = 'in-app-notification';
  notification.innerHTML = `
    <div style="font-weight: bold; font-size: 0.95rem; margin-bottom: 4px;">${title}</div>
    <div style="font-size: 0.8rem; color: var(--text-secondary);">${body}</div>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-100px);
    z-index: 10000;
    background: linear-gradient(135deg, rgba(20,20,40,0.95), rgba(30,30,60,0.95));
    border: 1px solid var(--accent-cyan, #06b6d4);
    border-radius: 12px;
    padding: 14px 20px;
    color: #fff;
    max-width: 85vw;
    box-shadow: 0 8px 32px rgba(6,182,212,0.3);
    backdrop-filter: blur(10px);
    transition: transform 0.4s ease-out, opacity 0.4s ease-out;
    opacity: 0;
    cursor: pointer;
  `;
  
  document.body.appendChild(notification);
  
  // スライドイン
  requestAnimationFrame(() => {
    notification.style.transform = 'translateX(-50%) translateY(0)';
    notification.style.opacity = '1';
  });
  
  // タップで閉じる
  notification.addEventListener('click', () => {
    notification.style.transform = 'translateX(-50%) translateY(-100px)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 400);
  });
  
  // 5秒後に自動で消える
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.transform = 'translateX(-50%) translateY(-100px)';
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 400);
    }
  }, 5000);
}

// ==========================================
// YouTube BGM 制御
// ==========================================
let ytPlayer;
let ytReady = false;

window.onYouTubeIframeAPIReady = function() {
  ytReady = true;
  initBgm();
};

function initBgm() {
  if (!ytReady) return;
  const urlOrId = localStorage.getItem('bgmYoutubeUrl') || '';
  const isEnabled = localStorage.getItem('bgmEnabled') === 'true';
  const videoId = extractYoutubeId(urlOrId);
  
  if (videoId && isEnabled) {
    playYoutubeBgm(videoId);
  }
}

function extractYoutubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  if (url.length === 11) {
    return url;
  }
  return null;
}

function playYoutubeBgm(videoId) {
  if (ytPlayer && ytPlayer.loadVideoById) {
    ytPlayer.loadVideoById({
      videoId: videoId
    });
  } else {
    ytPlayer = new YT.Player('youtubePlayer', {
      height: '0',
      width: '0',
      videoId: videoId,
      playerVars: {
        'autoplay': 1,
        'loop': 1,
        'playlist': videoId,
        'controls': 0
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
  }
}

function onPlayerReady(event) {
  event.target.setVolume(30);
  event.target.playVideo();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    event.target.playVideo();
  }
}

function stopYoutubeBgm() {
  if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
    ytPlayer.pauseVideo();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // --- ご要望によるステータス強制上書き（1回のみ実行） ---
  if (!localStorage.getItem('forceStateOverrideV1')) {
    localStorage.setItem('dragonDiaryExp', '220');
    localStorage.setItem('unlockedAchievements', JSON.stringify(['first_step', '3days']));
    localStorage.setItem('forceStateOverrideV1', 'true');
    console.log('[Override] 経験値を220、実績を初期状態にセットしました');
  }

  // 要素の取得
  const dragonContainer = document.querySelector('.dragon-container');
  const bgmToggle = document.getElementById('bgmToggle');
  const bgmUrl = document.getElementById('bgmYoutubeUrl');
  
  if (bgmToggle && bgmUrl) {
    bgmToggle.checked = localStorage.getItem('bgmEnabled') === 'true';
    bgmUrl.value = localStorage.getItem('bgmYoutubeUrl') || '';
    
    bgmToggle.addEventListener('change', (e) => {
      localStorage.setItem('bgmEnabled', e.target.checked);
      if (e.target.checked) {
        const videoId = extractYoutubeId(bgmUrl.value);
        if (videoId) {
          playYoutubeBgm(videoId);
        } else {
          alert('有効なYouTubeのURLまたはIDを入力してください。');
          e.target.checked = false;
          localStorage.setItem('bgmEnabled', false);
        }
      } else {
        stopYoutubeBgm();
      }
    });
    
    bgmUrl.addEventListener('change', (e) => {
      localStorage.setItem('bgmYoutubeUrl', e.target.value);
      if (bgmToggle.checked) {
        const videoId = extractYoutubeId(e.target.value);
        if (videoId) playYoutubeBgm(videoId);
      }
    });
  }
  
  document.body.addEventListener('click', () => {
    const isEnabled = localStorage.getItem('bgmEnabled') === 'true';
    if (isEnabled && ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
      const state = ytPlayer.getPlayerState();
      if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
        ytPlayer.playVideo();
      }
    }
  });

  // Radar card long press (2 seconds) to flip
  const cardRadar = document.getElementById('cardRadar');
  if (cardRadar) {
    let pressTimer;
    let startY = 0;
    let startX = 0;

    const startPress = (e) => {
      // タッチの初期位置を記録
      if (e.touches && e.touches.length > 0) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      }
      pressTimer = setTimeout(() => {
        window.isLongPressFired = true; // シャッフル防止用フラグ
        cardRadar.classList.toggle('flipped');
      }, 2000);
    };

    const cancelPress = () => {
      clearTimeout(pressTimer);
    };

    const onTouchMove = (e) => {
      if (!pressTimer || !e.touches || e.touches.length === 0) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      // 10px以上動いたらスクロールとみなしてキャンセル
      if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
        cancelPress();
      }
    };

    cardRadar.addEventListener('mousedown', startPress);
    cardRadar.addEventListener('touchstart', startPress, { passive: true });
    
    cardRadar.addEventListener('mouseup', cancelPress);
    cardRadar.addEventListener('mouseleave', cancelPress);
    cardRadar.addEventListener('touchend', (e) => {
      cancelPress();
      // 長押し発動直後の touchend では preventDefault して click を防ぐ（※passive:falseが必要になるため、代わりにclick側でフラグ判定する）
    });
    cardRadar.addEventListener('touchcancel', cancelPress);
    cardRadar.addEventListener('touchmove', onTouchMove, { passive: true });
  }
});

