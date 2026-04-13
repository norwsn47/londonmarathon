import { CORS, checkAuth, unauthorized } from '../_auth';

interface Env { DB: D1Database; }

interface OMRow {
  id: string; title: string; description: string;
  distance_km: number; lat: number; lng: number; sort_order: number;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!checkAuth(request)) return unauthorized();

  const id = params.id as string;

  if (request.method === 'PUT') {
    let body: Partial<OMRow>;
    try { body = await request.json() as Partial<OMRow>; } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS }); }

    const { title, description, distance_km, lat, lng, sort_order } = body;
    if (!title?.trim() || distance_km == null || lat == null || lng == null) {
      return Response.json({ error: 'title, distance_km, lat, lng are required' }, { status: 400, headers: CORS });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return Response.json({ error: 'Invalid lat/lng range' }, { status: 400, headers: CORS });
    }

    const result = await env.DB.prepare(
      'UPDATE official_markers SET title=?, description=?, distance_km=?, lat=?, lng=?, sort_order=?, updated_at=datetime(\'now\') WHERE id=?'
    ).bind(title.trim(), (description ?? '').trim(), distance_km, lat, lng, sort_order ?? 0, id).run();

    if (result.meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
    const row = await env.DB.prepare('SELECT * FROM official_markers WHERE id = ?').bind(id).first<OMRow>();
    return Response.json(row, { headers: CORS });
  }

  if (request.method === 'DELETE') {
    const result = await env.DB.prepare('DELETE FROM official_markers WHERE id = ?').bind(id).run();
    if (result.meta.changes === 0) return Response.json({ error: 'Not found' }, { status: 404, headers: CORS });
    return new Response(null, { status: 204, headers: CORS });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
};
