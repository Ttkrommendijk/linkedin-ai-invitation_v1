import { createEventHandler } from './handler.mjs';

const projectUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function db(path: string, init: RequestInit = {}) {
  const response = await fetch(`${projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Database HTTP ${response.status}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
Deno.serve(createEventHandler({db}));
