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
