interface Env {
  DB: D1Database;
}

interface MarkerRow {
  id: string;
  lat: number;
  lng: number;
  title: string;
  description: string;
  type: string;
}

interface PostBody {
  lat: number;
  lng: number;
  title: string;
  description?: string;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, lat, lng, title, description, type FROM markers ORDER BY rowid DESC'
    ).all<MarkerRow>();
    return Response.json(results ?? [], { headers: corsHeaders() });
  }

  if (request.method === 'POST') {
    let body: PostBody;
    try {
      body = await request.json() as PostBody;
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() });
    }

    const { lat, lng, title, description = '' } = body;
    if (typeof lat !== 'number' || typeof lng !== 'number' || !title?.trim()) {
      return Response.json({ error: 'lat, lng and title are required' }, { status: 400, headers: corsHeaders() });
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO markers (id, lat, lng, title, description, type) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, lat, lng, title.trim(), description.trim(), 'user').run();

    const marker: MarkerRow = { id, lat, lng, title: title.trim(), description: description.trim(), type: 'user' };
    return Response.json(marker, { status: 201, headers: corsHeaders() });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
};
