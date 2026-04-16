// 標高プロファイルの描画
// Canvas 2D で距離/標高の折れ線グラフを描画する。依存ライブラリなし。
// 2枚のキャンバスを重ね、下: 本体チャート / 上: ホバー用クロスハイライトオーバーレイ。

let chartState = null; // { elevations, distances, toX, toY, padTop, chartH } 直近のジオメトリ
let onProfileHoverCallback = null;
let onProfileClickCallback = null;

function setProfileHoverHandler(callback) {
  onProfileHoverCallback = callback;
}

function setProfileClickHandler(callback) {
  onProfileClickCallback = callback;
}

/**
 * トラックポイントから標高値を取り出す（欠損は前の有効値で埋める）
 * @returns {elevations: number[]|null, hasData: boolean}
 */
function extractElevations(trackpoints) {
  const raw = trackpoints.map(tp => {
    const e = parseFloat(tp.elevation);
    return isNaN(e) ? null : e;
  });
  const validCount = raw.filter(e => e !== null).length;
  if (validCount === 0) return { elevations: null, hasData: false };

  let firstValid = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== null) { firstValid = raw[i]; break; }
  }
  let lastValid = firstValid;
  const filled = raw.map(e => {
    if (e !== null) { lastValid = e; return e; }
    return lastValid;
  });
  return { elevations: filled, hasData: true };
}

function computeElevationStats(elevations) {
  let min = Infinity, max = -Infinity, gain = 0, loss = 0;
  for (let i = 0; i < elevations.length; i++) {
    const e = elevations[i];
    if (e < min) min = e;
    if (e > max) max = e;
    if (i > 0) {
      const d = elevations[i] - elevations[i - 1];
      if (d > 0) gain += d;
      else loss -= d;
    }
  }
  return { min, max, gain, loss };
}

/**
 * 総距離に応じて、横軸の補助線間隔を「きりのいい値」で返す。
 * だいたい 4〜7 本程度の補助線になるよう調整する。
 */
function chooseDistanceGuideStep(totalDistMeters) {
  if (!isFinite(totalDistMeters) || totalDistMeters <= 0) return null;

  const totalKm = totalDistMeters / 1000;
  const roughStepKm = totalKm / 5;
  const magnitude = 10 ** Math.floor(Math.log10(roughStepKm));
  const normalized = roughStepKm / magnitude;
  const niceSteps = [1, 2, 2.5, 5, 10];
  const step = niceSteps.find(s => normalized <= s) || 10;

  return step * magnitude * 1000;
}

function formatDistanceKm(km) {
  if (Math.abs(km - Math.round(km)) < 1e-9) {
    return String(Math.round(km));
  }
  if (Math.abs(km * 10 - Math.round(km * 10)) < 1e-9) {
    return km.toFixed(1);
  }
  return km.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

function drawTopRightLabel(ctx, text, rightX, topY) {
  ctx.save();
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
  const paddingX = 4;
  const paddingY = 2;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 12 + paddingY * 2;
  const boxX = rightX - boxWidth;
  const boxY = topY;

  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(text, rightX - paddingX, boxY + paddingY);
  ctx.restore();
}

function setElevationProfileVisible(visible) {
  const panel = document.getElementById('elevation-profile');
  if (!panel) return;
  const wasHidden = panel.classList.contains('hidden');
  const shouldHide = !visible;
  if (wasHidden === shouldHide) return;
  panel.classList.toggle('hidden', shouldHide);
  const m = (typeof getMap === 'function') ? getMap() : null;
  if (m) m.invalidateSize();
}

// DPR対応でキャンバスを高解像度化して変換行列を設定
function setupHiDpiCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

/**
 * 本体チャートを描画。統計テキストもヘッダーに反映。
 */
function drawElevationProfile(trackpoints) {
  const panel = document.getElementById('elevation-profile');
  const statsEl = document.getElementById('elevation-stats');
  const canvas = document.getElementById('elevation-canvas');
  if (!panel || !statsEl || !canvas) return;

  // データなし → クリア
  if (!trackpoints || trackpoints.length < 2) {
    statsEl.textContent = '';
    chartState = null;
    drawElevationOverlay(null);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const { elevations, hasData } = extractElevations(trackpoints);
  if (!hasData) {
    statsEl.textContent = t('elevation.no_data');
    chartState = null;
    drawElevationOverlay(null);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (panel.classList.contains('hidden')) {
    chartState = null;
    drawElevationOverlay(null);
    return;
  }

  const distances = calculateCumulativeDistances(trackpoints);
  const totalDist = distances[distances.length - 1];
  const { min, max, gain, loss } = computeElevationStats(elevations);

  statsEl.textContent = t('elevation.stats', {
    min: Math.round(min),
    max: Math.round(max),
    gain: Math.round(gain),
    loss: Math.round(loss),
  });

  // 折りたたみ中は描画スキップ（可視化不要）
  if (panel.classList.contains('collapsed')) {
    chartState = null;
    return;
  }

  const setup = setupHiDpiCanvas(canvas);
  if (!setup) return;
  const { ctx, w, h } = setup;

  // padTop はホバー時のラベル帯（チャート上）を確保するため広めに取る
  const padLeft = 42, padRight = 10, padTop = 22, padBottom = 18;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  ctx.clearRect(0, 0, w, h);

  const range = Math.max(max - min, 1);
  const yMin = min - range * 0.1;
  const yMax = max + range * 0.1;

  const toX = dist => padLeft + (dist / totalDist) * chartW;
  const toY = ele => padTop + chartH - ((ele - yMin) / (yMax - yMin)) * chartH;

  // グリッド
  const gridLevels = [min, (min + max) / 2, max];
  const distanceGuideStep = chooseDistanceGuideStep(totalDist);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const lv of gridLevels) {
    const y = toY(lv);
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
  }
  if (distanceGuideStep) {
    for (let dist = distanceGuideStep; dist < totalDist; dist += distanceGuideStep) {
      const x = toX(dist);
      ctx.moveTo(x, padTop);
      ctx.lineTo(x, padTop + chartH);
    }
  }
  ctx.stroke();

  // 塗りつぶし
  ctx.fillStyle = 'rgba(37, 99, 235, 0.18)';
  ctx.beginPath();
  ctx.moveTo(toX(0), padTop + chartH);
  for (let i = 0; i < elevations.length; i++) {
    ctx.lineTo(toX(distances[i]), toY(elevations[i]));
  }
  ctx.lineTo(toX(totalDist), padTop + chartH);
  ctx.closePath();
  ctx.fill();

  // 折れ線
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < elevations.length; i++) {
    const x = toX(distances[i]);
    const y = toY(elevations[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // 軸ラベル
  ctx.fillStyle = '#64748b';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(max)} m`, padLeft - 4, toY(max));
  ctx.fillText(`${Math.round(min)} m`, padLeft - 4, toY(min));

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText('0 km', padLeft, padTop + chartH + 4);
  if (distanceGuideStep) {
    for (let dist = distanceGuideStep; dist < totalDist; dist += distanceGuideStep) {
      const x = toX(dist);
      if (x - padLeft < 28 || padLeft + chartW - x < 28) continue;
      ctx.textAlign = 'center';
      ctx.fillText(`${formatDistanceKm(dist / 1000)} km`, x, padTop + chartH + 4);
    }
  }
  // 総距離ラベルの縦位置を左側の最大標高ラベル（toY(max)）と合わせる
  // drawTopRightLabel は boxHeight = 12 + paddingY*2 = 16 で描画するため、中心を合わせるには -8
  drawTopRightLabel(ctx, `${formatDistanceKm(totalDist / 1000)} km`, padLeft + chartW - 2, toY(max) - 8);

  // ホバー計算用のジオメトリを保持
  chartState = {
    elevations, distances, totalDist,
    toX, toY,
    padLeft, padTop, chartW, chartH,
  };

  // 既存のホバー描画を再現（オーバーレイはサイズが変わると再描画が必要）
  drawElevationOverlay(null);
}

/**
 * オーバーレイキャンバスにクロスハイライト（縦線＋点）を描画。
 * index が null の場合はクリア。
 */
function drawElevationOverlay(index) {
  const overlay = document.getElementById('elevation-overlay');
  if (!overlay) return;

  const setup = setupHiDpiCanvas(overlay);
  if (!setup) return;
  const { ctx, w, h } = setup;
  ctx.clearRect(0, 0, w, h);

  if (index == null || !chartState) return;
  const { elevations, distances, toX, toY, padLeft, padTop, chartW, chartH } = chartState;
  if (index < 0 || index >= elevations.length) return;

  const x = toX(distances[index]);
  const y = toY(elevations[index]);

  // 縦線（破線）
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, padTop);
  ctx.lineTo(x, padTop + chartH);
  ctx.stroke();
  ctx.setLineDash([]);

  // 点
  ctx.fillStyle = '#ef4444';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // 距離と標高のラベル（チャート上の帯に赤文字で、十字線のxに追従）
  const labelText = `${formatDistanceKm(distances[index] / 1000)} km / ${Math.round(elevations[index])} m`;
  ctx.save();
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  const paddingX = 5;
  const paddingY = 2;
  const textWidth = ctx.measureText(labelText).width;
  const boxWidth = textWidth + paddingX * 2;
  const boxHeight = 13 + paddingY * 2;
  // 十字線のxを中心にしつつ、チャート横幅内に収まるようクランプ
  let boxX = x - boxWidth / 2;
  const minX = padLeft;
  const maxX = padLeft + chartW - boxWidth;
  if (boxX < minX) boxX = minX;
  if (boxX > maxX) boxX = maxX;
  // チャート上端（padTop）よりさらに上の帯に配置
  const boxY = Math.max(2, padTop - boxHeight - 2);

  // 視認性のための白背景
  ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = '#ef4444';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(labelText, boxX + paddingX, boxY + paddingY);
  ctx.restore();
}

/**
 * プロファイル上のマウスX座標から最近傍のトラックポイントindexを返す
 */
function xToTrackpointIndex(mouseX) {
  if (!chartState) return null;
  const { distances, toX } = chartState;
  // 二分探索でも良いがO(n)でも十分軽い
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < distances.length; i++) {
    const diff = Math.abs(toX(distances[i]) - mouseX);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

/**
 * 折りたたみ状態を明示的に設定（ルート読込時にオープン、リセット時にクローズ）
 */
function setElevationProfileCollapsed(collapsed) {
  const panel = document.getElementById('elevation-profile');
  const btn = document.getElementById('btn-elevation-toggle');
  if (!panel || !btn) return;
  const wasCollapsed = panel.classList.contains('collapsed');
  if (wasCollapsed === collapsed) return;
  panel.classList.toggle('collapsed', collapsed);
  btn.textContent = collapsed ? '\u25B2' : '\u25BC';
  const m = (typeof getMap === 'function') ? getMap() : null;
  if (m) m.invalidateSize();
  if (!collapsed && typeof appState !== 'undefined') {
    drawElevationProfile(appState.trackpoints);
  }
}

function toggleElevationProfile() {
  const panel = document.getElementById('elevation-profile');
  if (!panel) return;
  if (panel.classList.contains('hidden')) return;
  setElevationProfileCollapsed(!panel.classList.contains('collapsed'));
}

function setupElevationProfile() {
  const panel = document.getElementById('elevation-profile');
  const btn = document.getElementById('btn-elevation-toggle');
  const canvas = document.getElementById('elevation-canvas');
  const overlay = document.getElementById('elevation-overlay');
  const wrap = document.querySelector('.elevation-canvas-wrap');
  if (!panel || !btn || !canvas || !overlay || !wrap) return;

  // 初期状態は非表示。表示時の折りたたみ状態はユーザー操作を保持する。
  panel.classList.add('hidden');
  btn.textContent = panel.classList.contains('collapsed') ? '\u25B2' : '\u25BC';

  btn.addEventListener('click', toggleElevationProfile);

  // プロファイル上のマウス移動でクロスハイライト
  wrap.addEventListener('mousemove', (e) => {
    if (panel.classList.contains('collapsed')) return;
    if (!chartState) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = xToTrackpointIndex(x);
    if (idx == null) return;
    drawElevationOverlay(idx);
    if (onProfileHoverCallback) onProfileHoverCallback(idx);
  });
  wrap.addEventListener('mouseleave', () => {
    drawElevationOverlay(null);
    if (onProfileHoverCallback) onProfileHoverCallback(null);
  });
  wrap.addEventListener('click', (e) => {
    if (panel.classList.contains('collapsed')) return;
    if (!chartState) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = xToTrackpointIndex(x);
    if (idx == null) return;
    drawElevationOverlay(idx);
    if (onProfileClickCallback) onProfileClickCallback(idx);
  });

  // キャンバスのサイズ変化に追従
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => {
      if (panel.classList.contains('collapsed')) return;
      if (typeof appState !== 'undefined') {
        drawElevationProfile(appState.trackpoints);
      }
    });
    ro.observe(canvas);
  } else {
    window.addEventListener('resize', () => {
      if (typeof appState !== 'undefined') {
        drawElevationProfile(appState.trackpoints);
      }
    });
  }
}
