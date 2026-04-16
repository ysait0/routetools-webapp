// ルートファイルのパーサー

/**
 * XML文字列からローカル名で要素を検索するヘルパー
 */
function getElementByLocalName(parent, localName) {
  return parent.getElementsByTagNameNS('*', localName)[0] || null;
}

function getElementsByLocalName(parent, localName) {
  return parent.getElementsByTagNameNS('*', localName);
}

function getTextByLocalName(parent, localName) {
  const el = getElementByLocalName(parent, localName);
  return el ? el.textContent : null;
}

// --- GPX パーサー ---
function parseGPX(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const metadataEl = getElementByLocalName(doc, 'metadata');
  const name = metadataEl ? getTextByLocalName(metadataEl, 'name') : null;
  const trkEl = getElementByLocalName(doc, 'trk');
  const type = trkEl ? getTextByLocalName(trkEl, 'type') : null;
  const metadata = { name: name, type: type || 'Ride' };

  const trackpoints = [];
  const trkpts = getElementsByLocalName(doc, 'trkpt');
  for (const trkpt of trkpts) {
    trackpoints.push({
      latitude: parseFloat(trkpt.getAttribute('lat')),
      longitude: parseFloat(trkpt.getAttribute('lon')),
      elevation: getTextByLocalName(trkpt, 'ele'),
      distance: null
    });
  }

  const pois = [];
  const wpts = getElementsByLocalName(doc, 'wpt');
  for (const wpt of wpts) {
    pois.push({
      latitude: parseFloat(wpt.getAttribute('lat')),
      longitude: parseFloat(wpt.getAttribute('lon')),
      name: getTextByLocalName(wpt, 'name'),
      notes: getTextByLocalName(wpt, 'desc'),
      type: getTextByLocalName(wpt, 'type'),
      symbol: getTextByLocalName(wpt, 'sym')
    });
  }

  return { metadata, trackpoints, pois };
}

// --- KML パーサー ---
function parseKML(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const docEl = getElementByLocalName(doc, 'Document');
  const name = docEl ? getTextByLocalName(docEl, 'name') : null;
  const metadata = { name: name, type: 'Ride' };

  const trackpoints = [];
  const pois = [];

  const placemarks = getElementsByLocalName(doc, 'Placemark');
  for (const placemark of placemarks) {
    const lineString = getElementByLocalName(placemark, 'LineString');
    if (lineString) {
      const coordsText = getTextByLocalName(lineString, 'coordinates');
      const lines = coordsText.trim().split(/\s+/);
      for (const line of lines) {
        const parts = line.trim().split(',');
        if (parts.length >= 2) {
          trackpoints.push({
            latitude: parseFloat(parts[1]),
            longitude: parseFloat(parts[0]),
            elevation: parts[2] || '0',
            distance: null
          });
        }
      }
    } else {
      const point = getElementByLocalName(placemark, 'Point');
      if (point) {
        const coordsText = getTextByLocalName(point, 'coordinates');
        const parts = coordsText.trim().split(',');
        pois.push({
          latitude: parseFloat(parts[1]),
          longitude: parseFloat(parts[0]),
          name: getTextByLocalName(placemark, 'name'),
          notes: getTextByLocalName(placemark, 'description'),
          type: null,
          symbol: null
        });
      }
    }
  }

  return { metadata, trackpoints, pois };
}

// --- KMZ パーサー (JSZip使用) ---
async function parseKMZ(arrayBuffer) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  let kmlContent = null;
  for (const filename of Object.keys(zip.files)) {
    if (filename.endsWith('.kml')) {
      kmlContent = await zip.files[filename].async('string');
      break;
    }
  }
  if (!kmlContent) {
    throw new Error('KMZファイル内にKMLが見つかりません');
  }
  return parseKML(kmlContent);
}

// --- TCX パーサー ---
function parseTCX(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  const nameRef = getElementByLocalName(doc, 'CourseNameRef');
  const name = nameRef ? getTextByLocalName(nameRef, 'Id') : null;
  const metadata = { name: name, type: 'Ride' };

  const trackpoints = [];
  const trkpts = getElementsByLocalName(doc, 'Trackpoint');
  for (const trkpt of trkpts) {
    const pos = getElementByLocalName(trkpt, 'Position');
    if (pos) {
      trackpoints.push({
        latitude: parseFloat(getTextByLocalName(pos, 'LatitudeDegrees')),
        longitude: parseFloat(getTextByLocalName(pos, 'LongitudeDegrees')),
        elevation: getTextByLocalName(trkpt, 'AltitudeMeters'),
        distance: getTextByLocalName(trkpt, 'DistanceMeters')
      });
    }
  }

  const pois = [];
  const crspts = getElementsByLocalName(doc, 'CoursePoint');
  for (const crspt of crspts) {
    const pos = getElementByLocalName(crspt, 'Position');
    pois.push({
      latitude: pos ? parseFloat(getTextByLocalName(pos, 'LatitudeDegrees')) : 0,
      longitude: pos ? parseFloat(getTextByLocalName(pos, 'LongitudeDegrees')) : 0,
      name: getTextByLocalName(crspt, 'Name'),
      notes: getTextByLocalName(crspt, 'Notes'),
      type: getTextByLocalName(crspt, 'PointType'),
      symbol: null
    });
  }

  return { metadata, trackpoints, pois };
}

// --- CSV パーサー ---
function parseCSV(csvString) {
  const pois = [];
  const lines = csvString.trim().split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = parseCSVLine(line);
    if (parts.length >= 4) {
      pois.push({
        latitude: parseFloat(parts[0]),
        longitude: parseFloat(parts[1]),
        name: parts[2],
        notes: parts[3],
        type: parts[4] || null,
        symbol: null
      });
    }
  }
  return { metadata: null, trackpoints: null, pois };
}

/**
 * CSV行をパース（カンマ区切り、引用符対応）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

// --- FIT パーサー (Garminのバイナリ形式) ---
// fit-file-parser は CommonJS なのでブラウザ用に esm.sh からESM経由で動的ロード
let _fitParserClassPromise = null;

function loadFitParserClass() {
  if (_fitParserClassPromise) return _fitParserClassPromise;
  _fitParserClassPromise = import('https://esm.sh/fit-file-parser@1.21.0')
    .then(mod => mod.default || mod)
    .catch(err => {
      _fitParserClassPromise = null; // 失敗時は次回リトライ可能に
      throw err;
    });
  return _fitParserClassPromise;
}

/**
 * course_point の type値を POI_TYPES と揃うよう Title Case に整形
 * 例: 'left' → 'Left', 'left_fork' → 'Left Fork'
 */
function normalizeCoursePointType(type) {
  if (type == null) return null;
  const s = String(type).trim();
  if (!s) return null;
  return s.split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

async function parseFIT(arrayBuffer) {
  let FitParserClass;
  try {
    FitParserClass = await loadFitParserClass();
  } catch (e) {
    throw new Error('FITパーサーの読み込みに失敗しました: ' + (e.message || e));
  }
  const parser = new FitParserClass({
    force: true,
    speedUnit: 'km/h',
    lengthUnit: 'm',
    temperatureUnit: 'celsius',
    elapsedRecordField: true,
    mode: 'list',
  });

  return new Promise((resolve, reject) => {
    parser.parse(arrayBuffer, (err, data) => {
      if (err) {
        reject(new Error('FITファイルのパースに失敗: ' + (err.message || err)));
        return;
      }
      try {
        resolve(fitDataToRoute(data));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function fitDataToRoute(data) {
  // トラックポイント: records から緯度経度を持つものを抽出
  const trackpoints = [];
  const records = data.records || [];
  for (const r of records) {
    if (r.position_lat != null && r.position_long != null) {
      trackpoints.push({
        latitude: r.position_lat,
        longitude: r.position_long,
        elevation: (r.altitude != null ? String(r.altitude) : null),
        distance: (r.distance != null ? String(r.distance) : null),
      });
    }
  }

  // POI: course_points (コースファイルの場合)
  const pois = [];
  const coursePoints = data.course_points || [];
  for (const cp of coursePoints) {
    if (cp.position_lat == null || cp.position_long == null) continue;
    pois.push({
      latitude: cp.position_lat,
      longitude: cp.position_long,
      name: cp.name || null,
      notes: null,
      type: normalizeCoursePointType(cp.type),
      symbol: null,
    });
  }

  // メタデータ: コース名があれば使う
  let name = null;
  if (data.course && data.course.name) {
    name = data.course.name;
  } else if (Array.isArray(data.courses) && data.courses.length > 0 && data.courses[0].name) {
    name = data.courses[0].name;
  }
  const metadata = { name: name, type: 'Ride' };

  return { metadata, trackpoints, pois };
}

/**
 * ファイルを自動判定してパース
 * @returns Promise<{metadata, trackpoints, pois}>
 */
async function parseFile(file) {
  const ext = file.name.split('.').pop().toUpperCase();

  if (ext === 'KMZ') {
    const buffer = await file.arrayBuffer();
    return parseKMZ(buffer);
  }
  if (ext === 'FIT') {
    const buffer = await file.arrayBuffer();
    return parseFIT(buffer);
  }

  const text = await file.text();

  switch (ext) {
    case 'GPX': return parseGPX(text);
    case 'KML': return parseKML(text);
    case 'TCX': return parseTCX(text);
    case 'CSV': return parseCSV(text);
    default:
      throw new Error(`未対応のファイル形式: ${ext}`);
  }
}
