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
 * 連続する近接トラックポイントを除去する。
 *
 * 条件:
 * - i と i+1 の距離が maxGapMeters 以下
 *
 * 上記を満たす場合、i+1 を削除する。
 * 連続する近接点は先頭1点だけ残す。
 */
function removeConsecutiveNearTrackpoints(trackpoints, options = {}) {
  const maxGapMeters = options.maxGapMeters || 3;

  if (!trackpoints || trackpoints.length < 2) {
    return {
      trackpoints: (trackpoints || []).map(tp => ({ ...tp, distance: null })),
      removedCount: 0,
    };
  }

  const next = [{ ...trackpoints[0], distance: null }];

  for (let i = 1; i < trackpoints.length; i++) {
    const prev = next[next.length - 1];
    const curr = trackpoints[i];
    const gap = haversineDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
    if (gap <= maxGapMeters) {
      continue;
    }
    next.push({ ...curr, distance: null });
  }

  return {
    trackpoints: next,
    removedCount: trackpoints.length - next.length,
  };
}

/**
 * 近接した冗長トラックポイントを除去する。
 *
 * 条件:
 * - まず i と i+1 の距離が 3m 以下なら i+1 を削除する
 * - (i-1 -> i) と (i+1 -> i+2) がほぼ一直線で、直線角が 170〜180 度
 * - i と i+1 の距離が 6m 以下
 *
 * 上記を満たす場合、i+1 を削除する。
 * 連鎖的に成立することがあるため、変化がなくなるまで繰り返す。
 */
function removeNearDuplicateStraightTrackpoints(trackpoints, options = {}) {
  const minStraightAngleDeg = options.minStraightAngleDeg || 170;
  const maxGapMeters = options.maxGapMeters || 6;
  const condensed = removeConsecutiveNearTrackpoints(trackpoints, { maxGapMeters: 3 });

  if (!trackpoints || trackpoints.length < 4) {
    return condensed;
  }

  if (condensed.trackpoints.length < 4) {
    return {
      trackpoints: condensed.trackpoints,
      removedCount: condensed.removedCount,
    };
  }

  let points = condensed.trackpoints;
  const originalLength = points.length;
  let changed = true;

  while (changed) {
    changed = false;
    const next = [];

    for (let i = 0; i < points.length; i++) {
      if (i >= 1 && i <= points.length - 3) {
        const pPrev = points[i - 1];
        const pCurr = points[i];
        const pNext = points[i + 1];
        const pNext2 = points[i + 2];
        const b1 = bearing(pPrev, pCurr);
        const b2 = bearing(pNext, pNext2);
        let diff = Math.abs(b2 - b1);
        if (diff > 180) diff = 360 - diff;
        const straightAngle = 180 - diff;
        const gap = haversineDistance(
          pCurr.latitude, pCurr.longitude,
          pNext.latitude, pNext.longitude
        );

        if (straightAngle >= minStraightAngleDeg && gap <= maxGapMeters) {
          next.push(pCurr);
          i += 1; // i+1 をスキップ
          changed = true;
          continue;
        }
      }
      next.push(points[i]);
    }

    points = next;
  }

  return {
    trackpoints: points,
    removedCount: condensed.removedCount + (originalLength - points.length),
  };
}

/**
 * 右左折の検出
 *
 * 判定対象点の前後1点を使い、3点の折れ角だけで右左折候補を検出する。
 * 前後の進行ベアリング差から小さい方の角度を求め、
 * それが最小閾値より大きく、最大閾値以下ならターンとみなす。
 *
 * @param trackpoints トラックポイント配列
 * @param options {minSmallAngleDeg, maxSmallAngleDeg}
 * @returns {index, point, angle, direction, distance}[]
 *   angle: 小さい方の角度（度）
 *   direction: 'Left' または 'Right'
 */
function detectTurns(trackpoints, options = {}) {
  const minSmallAngleDeg = options.minSmallAngleDeg || 5;
  const maxSmallAngleDeg = options.maxSmallAngleDeg || 120;

  if (!trackpoints || trackpoints.length < 3) return [];

  const cumDists = calculateCumulativeDistances(trackpoints);

  const candidates = [];

  for (let i = 1; i < trackpoints.length - 1; i++) {
    const bIn = bearing(trackpoints[i - 1], trackpoints[i]);
    const bOut = bearing(trackpoints[i], trackpoints[i + 1]);
    let diff = bOut - bIn;
    while (diff > 180) diff -= 360;
    while (diff <= -180) diff += 360;
    const smallAngle = 180 - Math.abs(diff);
    if (smallAngle <= minSmallAngleDeg) continue;
    if (smallAngle > maxSmallAngleDeg) continue;

    candidates.push({
      index: i,
      point: trackpoints[i],
      angle: smallAngle,
      direction: diff > 0 ? 'Right' : 'Left',
      distance: cumDists[i],
    });
  }

  return candidates;
}
