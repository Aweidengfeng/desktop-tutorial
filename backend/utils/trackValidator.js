function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2-lat1)*Math.PI/180;
  const dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function validateTrack(points) {
  if (!Array.isArray(points) || points.length < 2) return { ok: true };
  let totalDistance = 0;
  let minTs = points[0].ts, maxTs = points[0].ts;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i-1], p2 = points[i];
    const timeDiff = (p2.ts - p1.ts) / 1000; // seconds
    if (timeDiff <= 0) return { ok: false, reason: 'speed_anomaly', suspicious: true };
    const dist = calcDistance(p1.lat, p1.lng, p2.lat, p2.lng);
    totalDistance += dist;
    const speed = dist / (timeDiff / 3600); // km/h
    if (speed > 20) return { ok: false, reason: 'speed_anomaly', suspicious: true };
    const elevDiff = Math.abs((p2.ele || 0) - (p1.ele || 0));
    if (elevDiff > 500) return { ok: false, reason: 'elevation_jump', suspicious: true };
    if (p2.ts < minTs) minTs = p2.ts;
    if (p2.ts > maxTs) maxTs = p2.ts;
  }
  const totalMinutes = (maxTs - minTs) / 60000;
  if (totalMinutes < 10 && totalDistance > 5) return { ok: false, reason: 'too_fast', suspicious: true };
  return { ok: true };
}

module.exports = { validateTrack };
