export interface GpxPoint {
  distKm: number;
  lat: number;
  lng: number;
  ele: number;
}

export interface ElevSample {
  pct: number;
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

export function sampleElevationProfile(points: GpxPoint[], numSamples = 200): ElevSample[] {
  if (!points.length) return [];
  const totalDist = points[points.length - 1].distKm;
  if (totalDist === 0) return [];
  if (numSamples <= 1) return [{ pct: 0, ele: points[0].ele }];

  return Array.from({ length: numSamples }, (_, i) => {
    const pct = i / (numSamples - 1);
    return { pct, ele: interpolateEle(points, pct * totalDist) };
  });
}

function interpolateEle(points: GpxPoint[], targetDist: number): number {
  if (!points.length) return 0;
  if (targetDist <= points[0].distKm) return points[0].ele;
  const last = points[points.length - 1];
  if (targetDist >= last.distKm) return last.ele;
  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].distKm <= targetDist && points[i + 1].distKm >= targetDist) {
      const span = points[i + 1].distKm - points[i].distKm;
      if (span === 0) return points[i].ele;
      const t = (targetDist - points[i].distKm) / span;
      return points[i].ele + t * (points[i + 1].ele - points[i].ele);
    }
  }
  return last.ele;
}

/** Interpolate lat/lng position at a given distance along the track */
export function interpolatePosition(
  points: GpxPoint[],
  targetDistKm: number,
): { lat: number; lng: number } | null {
  if (!points.length) return null;
  if (targetDistKm <= 0) return { lat: points[0].lat, lng: points[0].lng };
  const last = points[points.length - 1];
  if (targetDistKm >= last.distKm) return { lat: last.lat, lng: last.lng };

  for (let i = 0; i < points.length - 1; i++) {
    if (points[i].distKm <= targetDistKm && points[i + 1].distKm >= targetDistKm) {
      const span = points[i + 1].distKm - points[i].distKm;
      if (span === 0) return { lat: points[i].lat, lng: points[i].lng };
      const t = (targetDistKm - points[i].distKm) / span;
      return {
        lat: points[i].lat + t * (points[i + 1].lat - points[i].lat),
        lng: points[i].lng + t * (points[i + 1].lng - points[i].lng),
      };
    }
  }
  return { lat: last.lat, lng: last.lng };
}
