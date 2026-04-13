export interface GpxPoint {
  distKm: number;
  lat: number;
  lng: number;
  ele: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function smooth(points: GpxPoint[], windowSize = 9): GpxPoint[] {
  return points.map((p, i) => {
    const lo = Math.max(0, i - Math.floor(windowSize / 2));
    const hi = Math.min(points.length, i + Math.floor(windowSize / 2) + 1);
    const avg = points.slice(lo, hi).reduce((s, x) => s + x.ele, 0) / (hi - lo);
    return { ...p, ele: avg };
  });
}

export function parseGpx(text: string): GpxPoint[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) return [];

  const trkpts = Array.from(doc.querySelectorAll('trkpt, rtept'));
  if (!trkpts.length) return [];

  let cumDist = 0;
  const raw: GpxPoint[] = [];
  let prevLat: number | null = null;
  let prevLon: number | null = null;

  for (const pt of trkpts) {
    const lat = parseFloat(pt.getAttribute('lat') ?? '');
    const lon = parseFloat(pt.getAttribute('lon') ?? '');
    if (!isFinite(lat) || !isFinite(lon)) continue;

    const eleText = pt.querySelector('ele')?.textContent ?? '';
    const ele = isFinite(parseFloat(eleText)) ? parseFloat(eleText) : 0;

    if (prevLat !== null && prevLon !== null) {
      cumDist += haversineKm(prevLat, prevLon, lat, lon);
    }

    raw.push({ distKm: cumDist, lat, lng: lon, ele });
    prevLat = lat;
    prevLon = lon;
  }

  if (!raw.length) return [];
  return smooth(raw);
}
