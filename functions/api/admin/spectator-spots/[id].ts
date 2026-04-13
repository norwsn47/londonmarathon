import { CORS, checkAuth, unauthorized } from '../_auth';

interface Env { DB: D1Database; }

interface SSRow {
  id: string; name: string; description: string;
  distance_km: number; distance_mile: number;
  lat: number; lng: number;
  nearest_stations: string | string[]; crowd_notes: string; sort_order: number;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!checkAuth(request)) return unauthorized();

  const id = params.id as string;

  if (request.method === 'PUT') {
    let body: Partial<SSRow>;
    try { body = await request.json() as Partial<SSRow>; } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS }); }

    const { name, description, distance_km, distance_mile, lat, lng, crowd_notes, sort_order } = body;
    if (!name?.trim() || distance_km == null || lat == null || lng == null) {
      return Response.json({ error: 'name, distance_km, lat, lng are required' }, { status: 400, headers: CORS });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return Response.json({ error: 'Invalid lat/lng range' }, { status: 400, headers: CORS });
    }

    const stationsRaw = body.nearest_stations ?? [];
    const stations = JSON.stringify(Array.isArray(stationsRaw) ? stationsRaw : String(stationsRaw).split(',').map(s => s.trim()).filter(Boolean));
    const distMile = distance_mile ?? +(distance_km / 1.60934).toFixed(2);

    const result = await env.DB.prepare(
      `UPDATE spectator_spots SET name=?, description=?, distance_km=?, distance_mile=?, lat=?, lng=?,
       nearest_stations=?, crowd_notes=?, sort_order=?, updated_at=datetime('now') WHERE id=?`
    ).bind(name.trim(), (description ?? '').trim(), distance_km, distMile, lat, lng, stations, (crowd_notes ?? '').trim(), sort_order ?? 0, id).run();

    if (result.meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
    const row = await env.DB.prepare('SELECT * FROM spectator_spots WHERE id = ?').bind(id).first<SSRow>();
    return Response.json(row, { headers: CORS });
  }

  if (request.method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM spectator_spots WHERE id = ?').bind(id).run();
    if (result.meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
    return new Response(null, { status: 204, headers: CORS });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
};
