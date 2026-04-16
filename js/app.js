// メインアプリケーション

const POI_TYPES = ['Generic', 'Flag', 'Straight', 'Left', 'Right'];

let appState = {
  metadata: null,
  trackpoints: [],
  pois: [],
  lastPOIResults: null,  // 最後のビルド結果（言語切替時の再描画用）
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

  // 言語セレクタ
  document.getElementById('language-selector').addEventListener('change', (e) => {
    setLanguage(e.target.value);
  });
});

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

// i18nから呼ばれる再描画ハンドラ
function onLanguageChanged() {
  updateDisplay();
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
    appState.pois = [];
    appState.lastPOIResults = null;
    updateDisplay();
    showStatus(t('status.all_poi_removed'));
  });

  // スタート/ゴールPOI追加ボタン
  document.getElementById('btn-add-start').addEventListener('click', () => addEndpointPOI('start'));
  document.getElementById('btn-add-goal').addEventListener('click', () => addEndpointPOI('goal'));

  // リセットボタン
  document.getElementById('btn-reset').addEventListener('click', handleReset);

  // ダウンロードボタン
  document.getElementById('btn-download').addEventListener('click', handleDownload);

  // ルートファイル用ドロップゾーン
  setupMiniDropZone('route-drop-zone', loadRouteFile);

  // POIファイル用ドロップゾーン
  setupMiniDropZone('poi-drop-zone', loadPOIFile);
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
    appState.metadata = result.metadata;
    appState.trackpoints = result.trackpoints;
    appState.pois = result.pois || [];
    appState.lastPOIResults = null;
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

function setFilename(type, name) {
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

function handleDownload() {
  if (!appState.trackpoints || appState.trackpoints.length === 0) {
    showStatus(t('status.error_no_route'), true);
    return;
  }

  const outType = document.getElementById('out-type').value;
  const tolerance = parseFloat(document.getElementById('tolerance').value);
  const force = document.getElementById('force').checked;

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
  const blob = new Blob([result.xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const baseName = (appState.metadata && appState.metadata.name) || 'route';
  a.href = url;
  a.download = `${baseName}.${outType.toLowerCase()}`;
  a.click();
  URL.revokeObjectURL(url);

  const added = result.poiResults.filter(r => r.status === 'added').length;
  const skipped = result.poiResults.filter(r => r.status === 'skipped').length;
  showStatus(t('status.download_complete', { added, skipped }));
}

function handleReset() {
  appState.metadata = null;
  appState.trackpoints = [];
  appState.pois = [];
  appState.lastPOIResults = null;
  document.getElementById('route-file').value = '';
  document.getElementById('poi-file').value = '';
  setFilename('route', '');
  setFilename('poi', '');
  updateDisplay();
  showStatus(t('status.reset'));
}

function removePOI(index) {
  const removed = appState.pois[index];
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
  });
  appState.lastPOIResults = null;
  updateDisplay();
  showStatus(t('status.poi_added_manual', { name: name }));
}

function updateDisplay() {
  displayRoute(appState.trackpoints);
  displayPOIs(appState.pois);
  updatePOIList();
  updateRouteInfo();
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
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll('.poi-type-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (!appState.pois[idx]) return;
      appState.pois[idx].type = e.currentTarget.value;
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
  appState.pois[idx][field] = newValue;
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
