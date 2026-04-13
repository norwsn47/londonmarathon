interface Env { DB: D1Database; }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const { results } = await env.DB.prepare(
    'SELECT id, title, description, distance_km, lat, lng FROM official_markers ORDER BY sort_order ASC'
  ).all<{ id: string; title: string; description: string; distance_km: number; lat: number; lng: number }>();

  const markers = (results ?? []).map(r => ({
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    title: r.title,
    description: r.description,
    type: 'official' as const,
    distanceKm: r.distance_km,
  }));

  return Response.json(markers, { headers: CORS });
};
