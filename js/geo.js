// 地理座標の距離計算ユーティリティ

/**
 * Haversine公式による2点間の距離計算（メートル）
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * POIに最も近いトラックポイントを検索
 * @returns {index, distance}
 */
function findNearestTrackpoint(poi, trackpoints) {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < trackpoints.length; i++) {
    const d = haversineDistance(
      poi.latitude, poi.longitude,
      trackpoints[i].latitude, trackpoints[i].longitude
    );
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return { index: minIdx, distance: minDist };
}

/**
 * トラックポイントの累積距離を計算
 * @returns 累積距離の配列（メートル）
 */
function calculateCumulativeDistances(trackpoints) {
  const distances = [0];
  for (let i = 1; i < trackpoints.length; i++) {
    const d = haversineDistance(
      trackpoints[i - 1].latitude, trackpoints[i - 1].longitude,
      trackpoints[i].latitude, trackpoints[i].longitude
    );
    distances.push(distances[i - 1] + d);
  }
  return distances;
}

/**
 * 2点間のbearing（方位角、0=北、時計回り、度）
 */
function bearing(p1, p2) {
  const phi1 = p1.latitude * Math.PI / 180;
  const phi2 = p2.latitude * Math.PI / 180;
  const deltaLambda = (p2.longitude - p1.longitude) * Math.PI / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * 180 / Math.PI + 360) % 360;
}

/**
 * 右左折の検出
 *
 * 2つのスケール(短い窓・長い窓)でのベアリング変化を比較し、
 * 短距離に集中した方向転換のみを「ターン」として検出する。
 * 一定曲率の緩やかなカーブは長い窓の角度が短い窓に比例して大きくなるため除外される。
 *
 * @param trackpoints トラックポイント配列
 * @param options {innerMeters, outerMeters, angleThresholdDeg, sharpnessRatio, minDistanceBetweenTurns}
 * @returns {index, point, angle, direction, distance}[]
 *   direction: 'Left' または 'Right'（正のangle=右折、負=左折として判定）
 */
function detectTurns(trackpoints, options = {}) {
  const innerMeters = options.innerMeters || 10;
  const outerMeters = options.outerMeters || 30;
  const angleThresholdDeg = options.angleThresholdDeg || 50;
  const sharpnessRatio = options.sharpnessRatio || 0.6;
  const minDistanceBetweenTurns = options.minDistanceBetweenTurns || 50;

  if (!trackpoints || trackpoints.length < 3) return [];

  const cumDists = calculateCumulativeDistances(trackpoints);

  // 指定スケールでのベアリング変化角を計算（取得不可ならnull）
  const angleAtScale = (i, scale) => {
    let before = i - 1;
    while (before > 0 && cumDists[i] - cumDists[before] < scale) before--;
    let after = i + 1;
    while (after < trackpoints.length - 1 && cumDists[after] - cumDists[i] < scale) after++;
    // 前後の距離が不足（トラック端など）はスキップ
    if (cumDists[i] - cumDists[before] < scale / 2) return null;
    if (cumDists[after] - cumDists[i] < scale / 2) return null;
    const bIn = bearing(trackpoints[before], trackpoints[i]);
    const bOut = bearing(trackpoints[i], trackpoints[after]);
    let diff = bOut - bIn;
    while (diff > 180) diff -= 360;
    while (diff <= -180) diff += 360;
    return diff;
  };

  const candidates = [];

  for (let i = 1; i < trackpoints.length - 1; i++) {
    const inner = angleAtScale(i, innerMeters);
    if (inner === null) continue;
    if (Math.abs(inner) < angleThresholdDeg) continue;

    // 緩やかなカーブの除外: 長い窓との角度比が小さい場合は連続カーブと判定
    const outer = angleAtScale(i, outerMeters);
    if (outer !== null && Math.abs(outer) > 1) {
      const ratio = Math.abs(inner) / Math.abs(outer);
      if (ratio < sharpnessRatio) continue;
    }

    candidates.push({
      index: i,
      point: trackpoints[i],
      angle: inner,
      direction: inner > 0 ? 'Right' : 'Left',
      distance: cumDists[i],
    });
  }

  // 近接する候補を統合（最大角度のものを代表に）
  const filtered = [];
  for (const c of candidates) {
    const last = filtered[filtered.length - 1];
    if (last && c.distance - last.distance < minDistanceBetweenTurns) {
      if (Math.abs(c.angle) > Math.abs(last.angle)) {
        filtered[filtered.length - 1] = c;
      }
    } else {
      filtered.push(c);
    }
  }

  return filtered;
}
