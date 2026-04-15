import { CORS, checkAuth, unauthorized } from './_auth';

interface Env { DB: D1Database; }

interface SSRow {
  id: string; name: string; description: string;
  distance_km: number; distance_mile: number;
  lat: number; lng: number;
  nearest_stations: string; crowd_notes: string; url: string;
  sort_order: number; updated_at: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, description, distance_km, distance_mile, lat, lng, nearest_stations, crowd_notes, url, sort_order, updated_at FROM spectator_spots ORDER BY sort_order ASC'
    ).all<SSRow>();
    return Response.json(results ?? [], { headers: CORS });
  }

  if (request.method === 'POST') {
    if (!checkAuth(request)) return unauthorized();
    let body: Partial<SSRow & { nearest_stations: string | string[] }>;
    try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS }); }

    const { name, description = '', distance_km, distance_mile, lat, lng, crowd_notes = '', url = '', sort_order = 0 } = body;
    if (!name?.trim() || distance_km == null || lat == null || lng == null) {
      return Response.json({ error: 'name, distance_km, lat, lng are required' }, { status: 400, headers: CORS });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return Response.json({ error: 'Invalid lat/lng range' }, { status: 400, headers: CORS });
    }

    const stationsRaw = body.nearest_stations ?? [];
    const stations = JSON.stringify(Array.isArray(stationsRaw) ? stationsRaw : String(stationsRaw).split(',').map(s => s.trim()).filter(Boolean));
    const distMile = distance_mile ?? +(distance_km / 1.60934).toFixed(2);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO spectator_spots (id, name, description, distance_km, distance_mile, lat, lng, nearest_stations, crowd_notes, url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, name.trim(), description.trim(), distance_km, distMile, lat, lng, stations, crowd_notes.trim(), url.trim(), sort_order).run();

    const row = await env.DB.prepare('SELECT * FROM spectator_spots WHERE id = ?').bind(id).first<SSRow>();
    return Response.json(row, { status: 201, headers: CORS });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
};
