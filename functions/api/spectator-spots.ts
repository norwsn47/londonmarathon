interface Env { DB: D1Database; }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface SpotRow {
  id: string; name: string; description: string;
  distance_km: number; distance_mile: number;
  lat: number; lng: number;
  nearest_stations: string; crowd_notes: string; url: string; maps_url: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const { results } = await env.DB.prepare(
    'SELECT id, name, description, distance_km, distance_mile, lat, lng, nearest_stations, crowd_notes, url, maps_url FROM spectator_spots ORDER BY sort_order ASC'
  ).all<SpotRow>();

  const spots = (results ?? []).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    distanceKm: r.distance_km,
    distanceMile: r.distance_mile,
    lat: r.lat,
    lng: r.lng,
    nearestStations: JSON.parse(r.nearest_stations || '[]') as string[],
    crowdNotes: r.crowd_notes,
    url: r.url ?? '',
    mapsUrl: r.maps_url ?? '',
  }));

  return Response.json(spots, { headers: CORS });
};
