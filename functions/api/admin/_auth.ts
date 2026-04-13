export const ADMIN_PASSWORD = 'london 26';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password',
};

export function checkAuth(request: Request): boolean {
  return request.headers.get('X-Admin-Password') === ADMIN_PASSWORD;
}

export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
}
