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
