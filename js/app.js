// メインアプリケーション

const POI_TYPES = ['Generic', 'Flag', 'Straight', 'Left', 'Right'];
const HISTORY_LIMIT = 100;

let appState = {
  metadata: null,
  trackpoints: [],
  pois: [],
  lastPOIResults: null,  // 最後のビルド結果（言語切替時の再描画用）
  originalFilename: null, // アップロード時の元ファイル名（拡張子なし）
  isReversed: false, // 現在のtrackpointsが反転済みか（チェックボックスと同期）
  routeFilename: null,
  poiFilename: null,
};

let historyState = {
  undoStack: [],
  redoStack: [],
  isApplying: false,
};

function buildPoiTypeOptions(currentType) {
  const types = [...POI_TYPES];
  if (currentType && !types.includes(currentType)) {
    types.push(currentType);
  }
  const selected = currentType || 'Generic';
  return types.map(type =>
    `<option value="${escapeHtml(type)}"${type === selected ? ' selected' : ''}>${escapeHtml(type)}</option>`
  ).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  loadSavedLanguage();
  applyTranslations();
  initMap('map');
  setupEventListeners();
  setupInfoTooltips();
  setRouteClickHandler(handleRouteClick);
  setMarkerClickHandler(handlePOIMarkerClick);
  setMarkerHoverHandler(handlePOIMarkerHover);
  setRouteHoverHandler(handleRouteHover);
  setProfileHoverHandler(handleProfileHover);
  setProfileClickHandler(handleProfileClick);
  setupSidebarResizer();
  setupElevationProfile();

  // タイトルクリックでリロード
  document.getElementById('app-title').addEventListener('click', () => {
    location.reload();
  });

  // 言語セレクタ
  document.getElementById('language-selector').addEventListener('change', (e) => {
    setLanguage(e.target.value);
  });

  updateHistoryButtons();
});

function cloneHistoryValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function captureSnapshot() {
  return cloneHistoryValue({
    metadata: appState.metadata,
    trackpoints: appState.trackpoints,
    pois: appState.pois,
    lastPOIResults: appState.lastPOIResults,
    originalFilename: appState.originalFilename,
    isReversed: appState.isReversed,
    routeFilename: appState.routeFilename,
    poiFilename: appState.poiFilename,
  });
}

function restoreSnapshot(snapshot) {
  appState = cloneHistoryValue(snapshot);
  document.getElementById('route-file').value = '';
  document.getElementById('poi-file').value = '';
  document.getElementById('reverse').checked = !!appState.isReversed;
  renderFilename('route', appState.routeFilename);
  renderFilename('poi', appState.poiFilename);
  updateDisplay();
}

function saveHistoryPoint() {
  if (historyState.isApplying) return;
  historyState.undoStack.push(captureSnapshot());
  if (historyState.undoStack.length > HISTORY_LIMIT) {
    historyState.undoStack.shift();
  }
  historyState.redoStack = [];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.disabled = historyState.undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = historyState.redoStack.length === 0;
}

function undoHistory() {
  if (historyState.undoStack.length === 0) return;
  historyState.redoStack.push(captureSnapshot());
  const snapshot = historyState.undoStack.pop();
  historyState.isApplying = true;
  try {
    restoreSnapshot(snapshot);
  } finally {
    historyState.isApplying = false;
  }
  updateHistoryButtons();
  showStatus(t('status.undo'));
}

function redoHistory() {
  if (historyState.redoStack.length === 0) return;
  historyState.undoStack.push(captureSnapshot());
  const snapshot = historyState.redoStack.pop();
  historyState.isApplying = true;
  try {
    restoreSnapshot(snapshot);
  } finally {
    historyState.isApplying = false;
  }
  updateHistoryButtons();
  showStatus(t('status.redo'));
}

function hasRestorableState() {
  return !!(
    (appState.trackpoints && appState.trackpoints.length > 0) ||
    (appState.pois && appState.pois.length > 0) ||
    appState.metadata ||
    appState.originalFilename ||
    appState.routeFilename ||
    appState.poiFilename
  );
}

function isTextEditingElement(target) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!target.closest('[contenteditable="true"]');
}

function handleGlobalKeydown(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  if (isTextEditingElement(e.target)) return;

  const key = e.key.toLowerCase();
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault();
    undoHistory();
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault();
    redoHistory();
  }
}

function handleRouteClick(latlng) {
  const content = `
    <div class="poi-add-popup">
      <h3>${t('popup.add_poi_title')}</h3>
      <input type="text" id="new-poi-name" placeholder="${t('placeholder.poi_name')}" />
      <input type="text" id="new-poi-notes" placeholder="${t('placeholder.poi_notes')}" />
      <select id="new-poi-type">${buildPoiTypeOptions('Generic')}</select>
      <div class="popup-actions">
        <button class="btn btn-secondary" id="btn-cancel-poi">${t('button.cancel')}</button>
        <button class="btn btn-primary" id="btn-confirm-poi">${t('button.add_poi')}</button>
      </div>
    </div>
  `;

  const popup = L.popup({ closeButton: true, minWidth: 220 })
    .setLatLng(latlng)
    .setContent(content)
    .openOn(getMap());

  // DOM挿入後にハンドラをバインド
  setTimeout(() => {
    const nameInput = document.getElementById('new-poi-name');
    if (nameInput) nameInput.focus();

    const confirm = () => {
      const name = (document.getElementById('new-poi-name').value || '').trim();
      const notes = (document.getElementById('new-poi-notes').value || '').trim();
      const type = document.getElementById('new-poi-type').value || 'Generic';
      saveHistoryPoint();
      appState.pois.push({
        latitude: latlng.lat,
        longitude: latlng.lng,
        name: name || null,
        notes: notes || null,
        type: type,
        symbol: null,
      });
      appState.lastPOIResults = null;
      getMap().closePopup(popup);
      updateDisplay();
      showStatus(t('status.poi_added_manual', { name: name || t('poi.no_name') }));
    };

    const cancel = () => getMap().closePopup(popup);

    document.getElementById('btn-confirm-poi').addEventListener('click', confirm);
    document.getElementById('btn-cancel-poi').addEventListener('click', cancel);
    // Enterキーで確定（ただしIME中は無視）
    ['new-poi-name', 'new-poi-notes'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          confirm();
        }
      });
    });
  }, 0);
}

// ルート上のマウス移動 → プロファイルと地図に対応位置のマーカーを出す
function handleRouteHover(index) {
  if (index == null) {
    clearRouteHighlight();
    drawElevationOverlay(null);
    return;
  }
  const tp = appState.trackpoints[index];
  if (!tp) return;
  setRouteHighlight([tp.latitude, tp.longitude]);
  drawElevationOverlay(index);
}

// プロファイル上のマウス移動 → 地図にマーカーを出す（プロファイル側はelevation.jsが描く）
function handleProfileHover(index) {
  if (index == null) {
    clearRouteHighlight();
    return;
  }
  const tp = appState.trackpoints[index];
  if (!tp) return;
  setRouteHighlight([tp.latitude, tp.longitude]);
}

// プロファイル上クリック → 対応するトラックポイント位置でPOI追加ポップアップを開く
function handleProfileClick(index) {
  const tp = appState.trackpoints[index];
  if (!tp) return;
  setRouteHighlight([tp.latitude, tp.longitude]);
  drawElevationOverlay(index);
  handleRouteClick({ lat: tp.latitude, lng: tp.longitude });
}

function handlePOIMarkerHover(index, hovering) {
  const tr = document.querySelector(`#poi-tbody tr[data-index="${index}"]`);
  if (hovering) {
    if (tr) {
      tr.classList.add('hover-highlight');
      // サイドバーが縦に長い場合に該当行を見えるように
      tr.scrollIntoView({ block: 'nearest' });
    }
    const poi = appState.pois[index];
    if (poi && appState.trackpoints && appState.trackpoints.length > 0) {
      const nearest = findNearestTrackpoint(poi, appState.trackpoints);
      drawElevationOverlay(nearest.index);
    }
  } else {
    if (tr) tr.classList.remove('hover-highlight');
    drawElevationOverlay(null);
  }
}

function handlePOIMarkerClick(index) {
  const poi = appState.pois[index];
  if (!poi) return;

  const content = `
    <div class="poi-add-popup">
      <h3>${t('popup.edit_poi_title')}</h3>
      <input type="text" id="edit-poi-name" placeholder="${t('placeholder.poi_name')}" value="${escapeHtml(poi.name) || ''}" />
      <input type="text" id="edit-poi-notes" placeholder="${t('placeholder.poi_notes')}" value="${escapeHtml(poi.notes) || ''}" />
      <select id="edit-poi-type">${buildPoiTypeOptions(poi.type)}</select>
      <div class="popup-actions">
        <button class="btn btn-danger" id="btn-delete-poi-popup">${t('button.delete')}</button>
        <button class="btn btn-secondary" id="btn-cancel-edit-poi">${t('button.cancel')}</button>
        <button class="btn btn-primary" id="btn-save-poi">${t('button.save')}</button>
      </div>
    </div>
  `;

  const popup = L.popup({ closeButton: true, minWidth: 240 })
    .setLatLng([poi.latitude, poi.longitude])
    .setContent(content)
    .openOn(getMap());

  setTimeout(() => {
    const nameInput = document.getElementById('edit-poi-name');
    if (nameInput) {
      nameInput.focus();
      nameInput.select();
    }

    const save = () => {
      const name = (document.getElementById('edit-poi-name').value || '').trim();
      const notes = (document.getElementById('edit-poi-notes').value || '').trim();
      const type = document.getElementById('edit-poi-type').value || 'Generic';
      if (!appState.pois[index]) return;
      const currentPoi = appState.pois[index];
      const nextName = name || null;
      const nextNotes = notes || null;
      if (currentPoi.name === nextName && currentPoi.notes === nextNotes && currentPoi.type === type) {
        getMap().closePopup(popup);
        return;
      }
      saveHistoryPoint();
      appState.pois[index].name = name || null;
      appState.pois[index].notes = notes || null;
      appState.pois[index].type = type;
      appState.lastPOIResults = null;
      getMap().closePopup(popup);
      updateDisplay();
      showStatus(t('status.poi_updated', { name: name || t('poi.no_name') }));
    };

    const cancel = () => getMap().closePopup(popup);

    const del = () => {
      getMap().closePopup(popup);
      removePOI(index);
    };

    document.getElementById('btn-save-poi').addEventListener('click', save);
    document.getElementById('btn-cancel-edit-poi').addEventListener('click', cancel);
    document.getElementById('btn-delete-poi-popup').addEventListener('click', del);
    // Enterキーで確定（IME中は無視）
    ['edit-poi-name', 'edit-poi-notes'].forEach(id => {
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          save();
        }
      });
    });
  }, 0);
}

// i18nから呼ばれる再描画ハンドラ
function onLanguageChanged() {
  updateDisplay();
}

function setupSidebarResizer() {
  const sidebar = document.querySelector('.sidebar');
  const resizer = document.getElementById('sidebar-resizer');
  if (!sidebar || !resizer) return;

  const MIN_WIDTH = 240;
  const MAX_WIDTH = 720;

  // 保存された幅を復元
  try {
    const saved = localStorage.getItem('routetools-sidebar-width');
    if (saved) {
      const w = parseInt(saved, 10);
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) sidebar.style.width = w + 'px';
    }
  } catch (e) { /* localStorage不可 */ }

  let dragging = false;

  resizer.addEventListener('mousedown', (e) => {
    dragging = true;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const mainEl = document.querySelector('main');
    const rect = mainEl.getBoundingClientRect();
    const newWidth = e.clientX - rect.left;
    const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
    sidebar.style.width = clamped + 'px';
    // 地図サイズが変わったのでLeafletに再計算を促す
    const m = getMap();
    if (m) m.invalidateSize();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try {
      const w = parseInt(sidebar.style.width, 10);
      if (w) localStorage.setItem('routetools-sidebar-width', String(w));
    } catch (e) { /* ignore */ }
  });
}

function setupInfoTooltips() {
  const tooltip = document.createElement('div');
  tooltip.className = 'info-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  document.querySelectorAll('.info-icon').forEach(icon => {
    icon.addEventListener('mouseenter', () => {
      const text = icon.dataset.tooltip;
      if (!text) return;
      tooltip.textContent = text;
      tooltip.style.display = 'block';

      const rect = icon.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();
      const margin = 8;

      // デフォルトはアイコンの上に配置
      let left = rect.left + rect.width / 2 - tipRect.width / 2;
      let top = rect.top - tipRect.height - margin;

      // ビューポート外に出ないように調整
      if (left < margin) left = margin;
      if (left + tipRect.width > window.innerWidth - margin) {
        left = window.innerWidth - tipRect.width - margin;
      }
      // 上にスペースがなければ下に表示
      if (top < margin) {
        top = rect.bottom + margin;
      }

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    });
    icon.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

function setupEventListeners() {
  // ルートファイルアップロード
  const routeInput = document.getElementById('route-file');
  routeInput.addEventListener('change', handleRouteFile);

  // POIファイルアップロード
  const poiInput = document.getElementById('poi-file');
  poiInput.addEventListener('change', handlePOIFile);

  // POI削除ボタン
  document.getElementById('btn-remove-poi').addEventListener('click', () => {
    if (appState.pois.length === 0) return;
    saveHistoryPoint();
    appState.pois = [];
    appState.lastPOIResults = null;
    updateDisplay();
    showStatus(t('status.all_poi_removed'));
  });

  // スタート/ゴールPOI追加ボタン
  document.getElementById('btn-add-start').addEventListener('click', () => addEndpointPOI('start'));
  document.getElementById('btn-add-goal').addEventListener('click', () => addEndpointPOI('goal'));

  // 右左折自動追加 / 自動追加POI削除
  document.getElementById('btn-auto-turn').addEventListener('click', handleAutoTurn);
  document.getElementById('btn-remove-auto').addEventListener('click', handleRemoveAutoPOIs);

  // リセットボタン
  document.getElementById('btn-reset').addEventListener('click', handleReset);

  // Undo / Redo
  document.getElementById('btn-undo').addEventListener('click', undoHistory);
  document.getElementById('btn-redo').addEventListener('click', redoHistory);

  // ダウンロードボタン
  document.getElementById('btn-download').addEventListener('click', handleDownload);

  // 逆走チェックボックス
  document.getElementById('reverse').addEventListener('change', handleReverseToggle);

  // ルートファイル用ドロップゾーン
  setupMiniDropZone('route-drop-zone', loadRouteFile);

  // POIファイル用ドロップゾーン
  setupMiniDropZone('poi-drop-zone', loadPOIFile);

  document.addEventListener('keydown', handleGlobalKeydown);
}

function setupMiniDropZone(zoneId, loader) {
  const zone = document.getElementById(zoneId);
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      await loader(e.dataTransfer.files[0]);
    }
  });
}

async function handleRouteFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  await loadRouteFile(file);
}

async function loadRouteFile(file) {
  try {
    showStatus(t('status.loading'));
    const result = await parseFile(file);
    if (!result.trackpoints || result.trackpoints.length === 0) {
      showStatus(t('status.error_no_trackpoints'), true);
      return;
    }
    saveHistoryPoint();
    appState.metadata = result.metadata;
    appState.trackpoints = result.trackpoints;
    appState.pois = result.pois || [];
    appState.lastPOIResults = null;
    // ダウンロード時のデフォルト名用に、拡張子を除いたファイル名を保持
    appState.originalFilename = file.name.replace(/\.[^./\\]+$/, '');
    // 新規読込は順方向で開始するため、逆走チェックをリセット
    appState.isReversed = false;
    document.getElementById('reverse').checked = false;
    setFilename('route', file.name);
    updateDisplay();
    showStatus(t('status.loaded', {
      filename: file.name,
      count: appState.trackpoints.length,
      poiCount: appState.pois.length,
    }));
  } catch (err) {
    showStatus(t('status.error', { message: err.message }), true);
  }
}

async function handlePOIFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  await loadPOIFile(file);
}

async function loadPOIFile(file) {
  try {
    showStatus(t('status.poi_loading'));
    const result = await parseFile(file);
    if (!result.pois || result.pois.length === 0) {
      showStatus(t('status.error_no_pois'), true);
      return;
    }
    saveHistoryPoint();
    appState.pois = appState.pois.concat(result.pois);
    appState.lastPOIResults = null;
    setFilename('poi', file.name);
    updateDisplay();
    showStatus(t('status.poi_added', {
      count: result.pois.length,
      total: appState.pois.length,
    }));
  } catch (err) {
    showStatus(t('status.error', { message: err.message }), true);
  }
}

function renderFilename(type, name) {
  const zone = document.getElementById(`${type}-drop-zone`);
  const label = document.getElementById(`${type}-filename`);
  if (name) {
    label.textContent = name;
    zone.classList.add('has-file');
  } else {
    label.textContent = '';
    zone.classList.remove('has-file');
  }
}

function setFilename(type, name) {
  if (type === 'route') {
    appState.routeFilename = name || null;
  } else if (type === 'poi') {
    appState.poiFilename = name || null;
  }
  renderFilename(type, name);
}

function handleDownload() {
  if (!appState.trackpoints || appState.trackpoints.length === 0) {
    showStatus(t('status.error_no_route'), true);
    return;
  }

  const outType = document.getElementById('out-type').value;
  const tolerance = parseFloat(document.getElementById('tolerance').value);
  const force = document.getElementById('force').checked;
  // 逆走オプションは表示時点で appState 自体を反転しているため、ここでは特別な処理は不要

  const options = { tolerance, force };
  let result;

  if (outType === 'GPX') {
    result = buildGPX(appState.metadata, appState.trackpoints, appState.pois, options);
  } else {
    result = buildTCX(appState.metadata, appState.trackpoints, appState.pois, options);
  }

  // 各POIに処理結果を付与（表示用、データ本体は変更しない）
  appState.lastPOIResults = result.poiResults;
  updatePOIList();

  // ダウンロード
  // 元ファイル名 > metadata.name > 'route' の優先順位
  // 上書き防止のため -routetools サフィックスを付与
  const baseName = appState.originalFilename
    || (appState.metadata && appState.metadata.name)
    || 'route';
  const blob = new Blob([result.xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}-routetools.${outType.toLowerCase()}`;
  a.click();
  URL.revokeObjectURL(url);

  const added = result.poiResults.filter(r => r.status === 'added').length;
  const skipped = result.poiResults.filter(r => r.status === 'skipped').length;
  showStatus(t('status.download_complete', { added, skipped }));
}

function handleReset() {
  if (hasRestorableState()) {
    saveHistoryPoint();
  }
  appState.metadata = null;
  appState.trackpoints = [];
  appState.pois = [];
  appState.lastPOIResults = null;
  appState.originalFilename = null;
  appState.isReversed = false;
  appState.routeFilename = null;
  appState.poiFilename = null;
  document.getElementById('route-file').value = '';
  document.getElementById('poi-file').value = '';
  document.getElementById('reverse').checked = false;
  setFilename('route', '');
  setFilename('poi', '');
  updateDisplay();
  showStatus(t('status.reset'));
}

function removePOI(index) {
  const removed = appState.pois[index];
  saveHistoryPoint();
  appState.pois.splice(index, 1);
  appState.lastPOIResults = null;
  updateDisplay();
  showStatus(t('status.poi_removed', { name: removed.name || t('poi.no_name') }));
}

function addEndpointPOI(endpoint) {
  if (!appState.trackpoints || appState.trackpoints.length === 0) {
    showStatus(t('status.error_no_route'), true);
    return;
  }
  saveHistoryPoint();
  const tp = endpoint === 'start'
    ? appState.trackpoints[0]
    : appState.trackpoints[appState.trackpoints.length - 1];
  const name = endpoint === 'start' ? t('poi.start_name') : t('poi.goal_name');
  appState.pois.push({
    latitude: tp.latitude,
    longitude: tp.longitude,
    name: name,
    notes: null,
    type: 'Generic',
    symbol: null,
    endpointRole: endpoint,
  });
  appState.lastPOIResults = null;
  updateDisplay();
  showStatus(t('status.poi_added_manual', { name: name }));
}

// 緯度経度を一意キーに（小数7桁で十分な精度）
function coordKey(lat, lon) {
  return `${lat.toFixed(7)},${lon.toFixed(7)}`;
}

function getStartGoalNameSets() {
  return {
    startNames: new Set(
      Object.values(translations).map(dict => dict['poi.start_name']).filter(Boolean)
    ),
    goalNames: new Set(
      Object.values(translations).map(dict => dict['poi.goal_name']).filter(Boolean)
    ),
  };
}

/**
 * 逆走チェックボックスのトグル処理。
 * trackpointsを物理的に反転し、端点にあるスタート/ゴールPOI名や
 * 右左折POIの向きも反転後の進行方向に合わせて入れ替える。
 * 画面表示（地図・POI一覧・標高プロファイル）に即反映する。
 * 再チェック時は同じ処理を行うことで元の状態に戻る（対称な反転操作）。
 */
function handleReverseToggle() {
  const checkbox = document.getElementById('reverse');
  const nowReversed = checkbox.checked;
  if (appState.isReversed === nowReversed) return;
  if (!appState.trackpoints || appState.trackpoints.length < 2) {
    appState.isReversed = nowReversed;
    return;
  }
  saveHistoryPoint();
  // 累積distanceは順序に依存するのでクリア（ビルダー側が再計算する）
  appState.trackpoints = appState.trackpoints
    .slice()
    .reverse()
    .map(tp => ({ ...tp, distance: null }));
  swapStartGoalPOINames();
  swapTurnPOIs();
  appState.isReversed = nowReversed;
  appState.lastPOIResults = null;
  updateDisplay();
}

/**
 * 反転後の端点（新しい先頭/末尾座標）にあるPOIで、名前が元の役割と食い違うものを入れ替え。
 * 反転後:
 *  - 新しい先頭座標 = 元の末尾座標。そこにあり「ゴール」名のPOI → 「スタート」に
 *  - 新しい末尾座標 = 元の先頭座標。そこにあり「スタート」名のPOI → 「ゴール」に
 * 全言語の名前を認識対象にすることで、言語切替を挟んでも正しく動く。
 */
function swapStartGoalPOINames() {
  if (appState.trackpoints.length < 2) return;
  const first = appState.trackpoints[0];
  const last = appState.trackpoints[appState.trackpoints.length - 1];
  const firstKey = coordKey(first.latitude, first.longitude);
  const lastKey = coordKey(last.latitude, last.longitude);
  const { startNames, goalNames } = getStartGoalNameSets();
  const newStartName = t('poi.start_name');
  const newGoalName = t('poi.goal_name');
  for (const poi of appState.pois) {
    if (poi.endpointRole === 'start') {
      poi.endpointRole = 'goal';
      poi.name = newGoalName;
      continue;
    }
    if (poi.endpointRole === 'goal') {
      poi.endpointRole = 'start';
      poi.name = newStartName;
      continue;
    }
    const key = coordKey(poi.latitude, poi.longitude);
    if (key === firstKey && goalNames.has(poi.name)) {
      poi.name = newStartName;
    } else if (key === lastKey && startNames.has(poi.name)) {
      poi.name = newGoalName;
    }
  }
}

/**
 * 逆走時は右左折の意味が反転するため、POIのtypeを Left/Right で入れ替える。
 * 名前については、自動追加POIは現在言語の標準名に更新し、
 * 手動POIでも名前が既知の「左折/右折」「Left/Right」に一致する場合のみ入れ替える。
 */
function swapTurnPOIs() {
  const leftNames = new Set(
    Object.values(translations).map(dict => dict['poi.turn_left']).filter(Boolean)
  );
  const rightNames = new Set(
    Object.values(translations).map(dict => dict['poi.turn_right']).filter(Boolean)
  );
  const leftLabel = t('poi.turn_left');
  const rightLabel = t('poi.turn_right');

  for (const poi of appState.pois) {
    if (poi.type === 'Left') {
      poi.type = 'Right';
      if (poi.autoGenerated || leftNames.has(poi.name)) {
        poi.name = rightLabel;
      }
    } else if (poi.type === 'Right') {
      poi.type = 'Left';
      if (poi.autoGenerated || rightNames.has(poi.name)) {
        poi.name = leftLabel;
      }
    }
  }
}

function handleAutoTurn() {
  if (!appState.trackpoints || appState.trackpoints.length < 3) {
    showStatus(t('status.error_no_route'), true);
    return;
  }
  const turns = detectTurns(appState.trackpoints);
  if (turns.length === 0) {
    showStatus(t('status.auto_turn_none'));
    return;
  }

  // 既存の自動追加POIの座標を集計
  const existingKeys = new Set();
  for (const poi of appState.pois) {
    if (poi.autoGenerated) {
      existingKeys.add(coordKey(poi.latitude, poi.longitude));
    }
  }

  // まだ追加されていないターンのみ対象
  const missing = turns.filter(tn =>
    !existingKeys.has(coordKey(tn.point.latitude, tn.point.longitude))
  );

  if (missing.length === 0) {
    // 全て既に追加済み → エラー扱い
    showStatus(t('status.auto_turn_all_exist'), true);
    return;
  }

  saveHistoryPoint();
  for (const turn of missing) {
    const name = turn.direction === 'Left' ? t('poi.turn_left') : t('poi.turn_right');
    appState.pois.push({
      latitude: turn.point.latitude,
      longitude: turn.point.longitude,
      name: name,
      notes: null,
      type: turn.direction,
      symbol: null,
      autoGenerated: true,
    });
  }
  appState.lastPOIResults = null;
  updateDisplay();
  showStatus(t('status.auto_turn_added', { count: missing.length }));
}

function handleRemoveAutoPOIs() {
  const before = appState.pois.length;
  const nextPois = appState.pois.filter(p => !p.autoGenerated);
  const removed = before - nextPois.length;
  if (removed === 0) {
    showStatus(t('status.no_auto_pois'));
    return;
  }
  saveHistoryPoint();
  appState.pois = nextPois;
  appState.lastPOIResults = null;
  updateDisplay();
  showStatus(t('status.auto_removed', { count: removed }));
}

/**
 * POIを現在のルート進行順に並べ替える。
 * 各POIから最近傍のトラックポイントを求め、その位置順でソートする。
 */
function sortPOIsByRouteOrder() {
  if (!appState.trackpoints || appState.trackpoints.length === 0 || appState.pois.length <= 1) {
    return;
  }

  const first = appState.trackpoints[0];
  const last = appState.trackpoints[appState.trackpoints.length - 1];
  const firstKey = coordKey(first.latitude, first.longitude);
  const lastKey = coordKey(last.latitude, last.longitude);
  const { startNames, goalNames } = getStartGoalNameSets();

  appState.pois = appState.pois
    .map((poi, originalIndex) => {
      const nearest = findNearestTrackpoint(poi, appState.trackpoints);
      const key = coordKey(poi.latitude, poi.longitude);
      let endpointSortKey = 0;

      if (poi.endpointRole === 'start') {
        endpointSortKey = -1;
      } else if (poi.endpointRole === 'goal') {
        endpointSortKey = 1;
      } else if (key === firstKey && key === lastKey) {
        if (startNames.has(poi.name)) endpointSortKey = -1;
        else if (goalNames.has(poi.name)) endpointSortKey = 1;
      } else if (key === firstKey && startNames.has(poi.name)) {
        endpointSortKey = -1;
      } else if (key === lastKey && goalNames.has(poi.name)) {
        endpointSortKey = 1;
      }

      return {
        poi,
        originalIndex,
        routeIndex: nearest.index,
        routeDistance: nearest.distance,
        endpointSortKey,
      };
    })
    .sort((a, b) => {
      if (a.endpointSortKey !== b.endpointSortKey) return a.endpointSortKey - b.endpointSortKey;
      if (a.routeIndex !== b.routeIndex) return a.routeIndex - b.routeIndex;
      if (a.routeDistance !== b.routeDistance) return a.routeDistance - b.routeDistance;
      return a.originalIndex - b.originalIndex;
    })
    .map(entry => entry.poi);
}

function updateDisplay() {
  setElevationProfileVisible(appState.trackpoints && appState.trackpoints.length > 0);
  sortPOIsByRouteOrder();
  displayRoute(appState.trackpoints);
  displayPOIs(appState.pois);
  updatePOIList();
  updateRouteInfo();
  drawElevationProfile(appState.trackpoints);
}

function updateRouteInfo() {
  const info = document.getElementById('route-info');
  if (!appState.trackpoints || appState.trackpoints.length === 0) {
    info.textContent = '';
    return;
  }
  const distances = calculateCumulativeDistances(appState.trackpoints);
  const totalKm = (distances[distances.length - 1] / 1000).toFixed(1);
  info.textContent = t('route_info', { count: appState.trackpoints.length, km: totalKm });
}

function updatePOIList() {
  const tbody = document.getElementById('poi-tbody');
  tbody.innerHTML = '';

  if (appState.pois.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="empty">${t('table.empty')}</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (let i = 0; i < appState.pois.length; i++) {
    const poi = appState.pois[i];
    const tr = document.createElement('tr');
    tr.dataset.index = i;
    // ダウンロード結果があれば行にステータスを反映
    const res = appState.lastPOIResults && appState.lastPOIResults[i];
    if (res) {
      tr.className = res.status === 'skipped' ? 'skipped' : 'added';
      tr.title = `${res.distance.toFixed(1)} m`;
    }
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="editable" data-index="${i}" data-field="name" contenteditable="true">${escapeHtml(poi.name) || ''}</td>
      <td class="editable" data-index="${i}" data-field="notes" contenteditable="true">${escapeHtml(poi.notes) || ''}</td>
      <td><select class="poi-type-select" data-index="${i}">${buildPoiTypeOptions(poi.type)}</select></td>
      <td><button class="btn-delete-poi" data-index="${i}" title="${t('button.remove_poi')}">×</button></td>
    `;
    // 行ホバーで対応する地図上のPOIをハイライト
    tr.addEventListener('mouseenter', () => highlightPOIMarker(i));
    tr.addEventListener('mouseleave', () => unhighlightPOIMarker(i));
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.poi-type-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (!appState.pois[idx]) return;
      const nextType = e.currentTarget.value;
      if (appState.pois[idx].type === nextType) return;
      saveHistoryPoint();
      appState.pois[idx].type = nextType;
      appState.lastPOIResults = null;
      updateDisplay();
    });
  });

  tbody.querySelectorAll('.btn-delete-poi').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      removePOI(idx);
    });
  });

  tbody.querySelectorAll('.editable').forEach(cell => {
    cell.addEventListener('blur', handleCellEdit);
    cell.addEventListener('keydown', (e) => {
      // IME変換中のEnterは確定用なので無視
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        cell.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        const idx = parseInt(cell.dataset.index, 10);
        const field = cell.dataset.field;
        cell.textContent = appState.pois[idx][field] || '';
        cell.blur();
      }
    });
  });
}

function handleCellEdit(e) {
  const cell = e.currentTarget;
  const idx = parseInt(cell.dataset.index, 10);
  const field = cell.dataset.field;
  if (!appState.pois[idx]) return;
  const newValue = cell.textContent.trim() || null;
  if (appState.pois[idx][field] === newValue) return;
  saveHistoryPoint();
  appState.pois[idx][field] = newValue;
  appState.lastPOIResults = null;
  updateDisplay();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showStatus(message, isError = false) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = 'status' + (isError ? ' error' : '');
}
