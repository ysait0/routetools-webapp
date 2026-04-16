// ルートファイルのビルダー

/**
 * GPXファイルを生成
 */
function buildGPX(metadata, trackpoints, pois, options) {
  const { tolerance, force } = options;
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.garmin.com/xmlschemas/GpxExtensions/v3">');
  lines.push(' <metadata>');
  lines.push(`  <name>${escapeXml(metadata.name || '')}</name>`);
  lines.push(' </metadata>');

  const poiResults = [];
  for (const poi of pois) {
    const nearest = findNearestTrackpoint(poi, trackpoints);
    if (nearest.distance > tolerance) {
      poiResults.push({ poi, status: 'skipped', distance: nearest.distance });
      continue;
    }
    poiResults.push({ poi, status: 'added', distance: nearest.distance });
    const lat = force ? trackpoints[nearest.index].latitude : poi.latitude;
    const lon = force ? trackpoints[nearest.index].longitude : poi.longitude;
    lines.push(` <wpt lat="${lat}" lon="${lon}">`);
    lines.push(`  <name>${escapeXml(poi.name || '')}</name>`);
    lines.push(`  <type>${escapeXml(poi.type || 'GENERIC')}</type>`);
    lines.push(' </wpt>');
  }

  lines.push(' <trk>');
  lines.push(`  <name>${escapeXml(metadata.name || '')}</name>`);
  lines.push(`  <type>${escapeXml(metadata.type || 'Ride')}</type>`);
  lines.push('  <trkseg>');
  for (const tp of trackpoints) {
    lines.push(`   <trkpt lat="${tp.latitude}" lon="${tp.longitude}">`);
    lines.push(`    <ele>${tp.elevation || '0'}</ele>`);
    lines.push('   </trkpt>');
  }
  lines.push('  </trkseg>');
  lines.push(' </trk>');
  lines.push('</gpx>');

  return { xml: lines.join('\n'), poiResults };
}

/**
 * TCXファイルを生成
 */
function buildTCX(metadata, trackpoints, pois, options) {
  const { tolerance } = options;
  const lines = [];

  // 距離データがない場合は計算
  let distances = null;
  if (!trackpoints[0].distance) {
    distances = calculateCumulativeDistances(trackpoints);
  }

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">');
  lines.push(' <Folders>');
  lines.push('  <Courses>');
  lines.push('   <CourseFolder Name="Courses">');
  lines.push('    <CourseNameRef>');
  lines.push(`     <Id>${escapeXml(metadata.name || '')}</Id>`);
  lines.push('    </CourseNameRef>');
  lines.push('   </CourseFolder>');
  lines.push('  </Courses>');
  lines.push(' </Folders>');
  lines.push(' <Courses>');
  lines.push('  <Course>');
  lines.push(`   <Name>${escapeXml(metadata.name || '')}</Name>`);
  lines.push('   <Track>');

  for (let i = 0; i < trackpoints.length; i++) {
    const tp = trackpoints[i];
    const dist = tp.distance || (distances ? distances[i].toString() : '0');
    lines.push('    <Trackpoint>');
    lines.push('     <Position>');
    lines.push(`      <LatitudeDegrees>${tp.latitude}</LatitudeDegrees>`);
    lines.push(`      <LongitudeDegrees>${tp.longitude}</LongitudeDegrees>`);
    lines.push('     </Position>');
    lines.push(`     <AltitudeMeters>${tp.elevation || '0'}</AltitudeMeters>`);
    lines.push(`     <DistanceMeters>${dist}</DistanceMeters>`);
    lines.push('    </Trackpoint>');
  }
  lines.push('   </Track>');

  const poiResults = [];
  for (const poi of pois) {
    const nearest = findNearestTrackpoint(poi, trackpoints);
    if (nearest.distance > tolerance) {
      poiResults.push({ poi, status: 'skipped', distance: nearest.distance });
      continue;
    }
    poiResults.push({ poi, status: 'added', distance: nearest.distance });
    // TCXは常にforce（最近傍トラックポイントの座標を使用）
    lines.push('   <CoursePoint>');
    lines.push(`    <Name>${escapeXml(poi.name || '')}</Name>`);
    lines.push(`    <Notes>${escapeXml(poi.notes || '')}</Notes>`);
    lines.push(`    <PointType>${escapeXml(poi.type || 'Generic')}</PointType>`);
    lines.push('    <Position>');
    lines.push(`     <LatitudeDegrees>${trackpoints[nearest.index].latitude}</LatitudeDegrees>`);
    lines.push(`     <LongitudeDegrees>${trackpoints[nearest.index].longitude}</LongitudeDegrees>`);
    lines.push('    </Position>');
    lines.push('   </CoursePoint>');
  }

  lines.push('  </Course>');
  lines.push(' </Courses>');
  lines.push('</TrainingCenterDatabase>');

  return { xml: lines.join('\n'), poiResults };
}

/**
 * XML特殊文字をエスケープ
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
