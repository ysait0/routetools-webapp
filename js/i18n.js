// 多言語対応
const translations = {
  ja: {
    // ヘッダー
    'header.title': 'routetools',
    'header.initial_status': 'ルートファイルを読み込んでください',

    // セクション
    'section.input_files': '入力ファイル',
    'section.output_options': '出力オプション',
    'section.poi_list': 'POI一覧',

    // イントロ（サイドバー上部の説明）
    'intro.features': 'ルートファイル（GPX / KML / KMZ / TCX）の<strong>形式変換</strong>と<strong>POIの追加・編集</strong>ができます。',
    'intro.privacy': 'ファイルはブラウザ内で処理され、サーバーには送信されません。',

    // ラベル
    'label.route_file': 'ルートファイル',
    'label.poi_add': 'POI追加 (任意)',
    'label.out_type': '出力形式',
    'label.tolerance': '許容距離 (m)',
    'label.force': 'Force',
    'label.force_caption': '最近傍点に配置',
    'label.language': '言語',

    // ドロップゾーン
    'dropzone.default': 'ドラッグ&ドロップ / クリックで選択',

    // ボタン
    'button.reset': 'リセット',
    'button.download': 'ダウンロード',
    'button.remove_poi': 'POI全削除',
    'button.add_poi': '追加',
    'button.cancel': 'キャンセル',
    'button.add_start': 'スタート追加',
    'button.add_goal': 'ゴール追加',

    // Start/Goal POI名
    'poi.start_name': 'スタート',
    'poi.goal_name': 'ゴール',

    // POI追加ポップアップ
    'popup.add_poi_title': 'POIを追加',
    'placeholder.poi_name': '名前を入力',
    'placeholder.poi_notes': '説明を入力（任意）',
    'placeholder.poi_type': 'タイプ（任意）',

    // テーブル
    'table.num': '#',
    'table.name': '名前',
    'table.description': '説明',
    'table.type': 'タイプ',
    'table.distance': '距離',
    'table.status': '状態',
    'table.empty': 'POIなし',

    // ツールチップ
    'tooltip.route_file': 'ベースとなるルートファイル。トラックポイント（ルートの軌跡）を含むファイルを指定します。対応形式: GPX / KML / KMZ / TCX',
    'tooltip.poi_add': '既存のルートにPOIを追加する場合に指定します。ファイル内のPOIのみが抽出され、現在のルートに追加されます。対応形式: GPX / KML / KMZ / TCX / CSV',
    'tooltip.tolerance': 'POIからルート上の最近傍点までの距離がこの値以下の場合のみ、POIを出力に含めます。この値を超えたPOIは「スキップ」として出力から除外されます（ダウンロード後、POI一覧では追加=緑、スキップ=赤で表示）。',
    'tooltip.force': 'ONの場合、POIをルート上の最近傍点に強制配置します。OFFの場合はPOIの元の座標を保持します。TCX出力時は常にON扱いです。',

    // ステータスメッセージ
    'status.loading': 'ファイルを読み込み中...',
    'status.poi_loading': 'POIファイルを読み込み中...',
    'status.reset': 'リセットしました',
    'status.all_poi_removed': 'POIを全て削除しました',
    'status.error_no_trackpoints': 'エラー: トラックポイントが見つかりません',
    'status.error_no_pois': 'エラー: POIが見つかりません',
    'status.error_no_route': 'エラー: ルートファイルを先に読み込んでください',
    'status.loaded': '読み込み完了: {filename} ({count}点, POI: {poiCount}件)',
    'status.poi_added': 'POI追加完了: {count}件追加 (合計: {total}件)',
    'status.poi_removed': 'POIを削除しました: {name}',
    'status.poi_added_manual': 'POIを追加しました: {name}',
    'status.download_complete': 'ダウンロード完了: POI {added}件追加, {skipped}件スキップ',
    'status.error': 'エラー: {message}',
    'route_info': 'トラックポイント: {count}点 / 距離: {km} km',
    'poi_status.added': '追加',
    'poi_status.skipped': 'スキップ',
    'poi.no_name': '(名前なし)',
  },
  en: {
    // Header
    'header.title': 'routetools',
    'header.initial_status': 'Please load a route file',

    // Sections
    'section.input_files': 'Input Files',
    'section.output_options': 'Output Options',
    'section.poi_list': 'POI List',

    // Intro (top of sidebar)
    'intro.features': '<strong>Convert</strong> route file formats (GPX / KML / KMZ / TCX) and <strong>add / edit POIs</strong>.',
    'intro.privacy': 'Files are processed locally in your browser and never sent to any server.',

    // Labels
    'label.route_file': 'Route File',
    'label.poi_add': 'Add POI (optional)',
    'label.out_type': 'Output Format',
    'label.tolerance': 'Tolerance (m)',
    'label.force': 'Force',
    'label.force_caption': 'Snap to nearest point',
    'label.language': 'Language',

    // Drop zone
    'dropzone.default': 'Drag & Drop / Click to select',

    // Buttons
    'button.reset': 'Reset',
    'button.download': 'Download',
    'button.remove_poi': 'Remove All POIs',
    'button.add_poi': 'Add',
    'button.cancel': 'Cancel',
    'button.add_start': 'Add Start',
    'button.add_goal': 'Add Goal',

    // Start/Goal POI name
    'poi.start_name': 'Start',
    'poi.goal_name': 'Goal',

    // POI add popup
    'popup.add_poi_title': 'Add POI',
    'placeholder.poi_name': 'Enter name',
    'placeholder.poi_notes': 'Enter description (optional)',
    'placeholder.poi_type': 'Type (optional)',

    // Table
    'table.num': '#',
    'table.name': 'Name',
    'table.description': 'Description',
    'table.type': 'Type',
    'table.distance': 'Distance',
    'table.status': 'Status',
    'table.empty': 'No POIs',

    // Tooltips
    'tooltip.route_file': 'The base route file containing trackpoints (route path). Supported formats: GPX / KML / KMZ / TCX',
    'tooltip.poi_add': 'Specify this when adding POIs to an existing route. Only POIs are extracted from the file and added to the current route. Supported formats: GPX / KML / KMZ / TCX / CSV',
    'tooltip.tolerance': 'POIs are included in the output only if the distance to the nearest point on the route is less than or equal to this value. POIs beyond this distance are "skipped" (excluded). After download, added POIs are shown in green and skipped POIs in red in the list.',
    'tooltip.force': 'When ON, POIs are snapped to the nearest point on the route. When OFF, the original POI coordinates are preserved. TCX output always treats this as ON.',

    // Status messages
    'status.loading': 'Loading file...',
    'status.poi_loading': 'Loading POI file...',
    'status.reset': 'Reset complete',
    'status.all_poi_removed': 'All POIs removed',
    'status.error_no_trackpoints': 'Error: No trackpoints found',
    'status.error_no_pois': 'Error: No POIs found',
    'status.error_no_route': 'Error: Please load a route file first',
    'status.loaded': 'Loaded: {filename} ({count} points, {poiCount} POIs)',
    'status.poi_added': 'POIs added: {count} (total: {total})',
    'status.poi_removed': 'POI removed: {name}',
    'status.poi_added_manual': 'POI added: {name}',
    'status.download_complete': 'Download complete: {added} POIs added, {skipped} skipped',
    'status.error': 'Error: {message}',
    'route_info': 'Trackpoints: {count} / Distance: {km} km',
    'poi_status.added': 'Added',
    'poi_status.skipped': 'Skipped',
    'poi.no_name': '(unnamed)',
  },
};

let currentLang = 'ja';

function t(key, params) {
  let text = (translations[currentLang] && translations[currentLang][key]) || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
  }
  return text;
}

function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  try {
    localStorage.setItem('routetools-lang', lang);
  } catch (e) {
    // localStorageが使えない場合は無視
  }
  applyTranslations();
}

function getLanguage() {
  return currentLang;
}

function loadSavedLanguage() {
  let saved;
  try {
    saved = localStorage.getItem('routetools-lang');
  } catch (e) {
    saved = null;
  }
  if (saved && translations[saved]) {
    currentLang = saved;
  } else {
    // ブラウザの言語設定をチェック
    const browserLang = (navigator.language || 'ja').substring(0, 2);
    if (translations[browserLang]) {
      currentLang = browserLang;
    }
  }
}

function applyTranslations() {
  // data-i18n属性を持つ要素のtextContentを更新
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  // data-i18n-html属性を持つ要素のinnerHTMLを更新（<strong>などのマークアップ可）
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    el.innerHTML = t(key);
  });

  // data-i18n-tooltip属性を持つ要素のdata-tooltipを更新
  document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
    const key = el.dataset.i18nTooltip;
    el.dataset.tooltip = t(key);
  });

  // html langを更新
  document.documentElement.lang = currentLang;

  // 言語セレクタの選択状態を更新
  const selector = document.getElementById('language-selector');
  if (selector) selector.value = currentLang;

  // アプリ側に再描画を依頼
  if (typeof onLanguageChanged === 'function') {
    onLanguageChanged();
  }
}
