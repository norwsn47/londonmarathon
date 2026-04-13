import { CORS, checkAuth, unauthorized } from './_auth';

interface Env { DB: D1Database; }

interface OMRow {
  id: string; title: string; description: string;
  distance_km: number; lat: number; lng: number; sort_order: number; updated_at: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, title, description, distance_km, lat, lng, sort_order, updated_at FROM official_markers ORDER BY sort_order ASC'
    ).all<OMRow>();
    return Response.json(results ?? [], { headers: CORS });
  }

  if (request.method === 'POST') {
    if (!checkAuth(request)) return unauthorized();
    let body: Partial<OMRow>;
    try { body = await request.json() as Partial<OMRow>; } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS }); }

    const { title, description = '', distance_km, lat, lng, sort_order = 0 } = body;
    if (!title?.trim() || distance_km == null || lat == null || lng == null) {
      return Response.json({ error: 'title, distance_km, lat, lng are required' }, { status: 400, headers: CORS });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return Response.json({ error: 'Invalid lat/lng range' }, { status: 400, headers: CORS });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO official_markers (id, title, description, distance_km, lat, lng, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, title.trim(), description.trim(), distance_km, lat, lng, sort_order).run();

    const row = await env.DB.prepare('SELECT * FROM official_markers WHERE id = ?').bind(id).first<OMRow>();
    return Response.json(row, { status: 201, headers: CORS });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
};
