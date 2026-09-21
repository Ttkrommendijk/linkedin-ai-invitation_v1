import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import * as teams from './teams-channel-read.mjs';

const owner = Object.keys(teams.CAPTURE_TARGETS)[0];
const target = teams.CAPTURE_TARGETS[owner];
const connection = { ...target, status: 'active', granted_scopes: ['Mail.Read', teams.TEAMS_SCOPE] };
const root = `/v1.0/teams/${target.team_id}/channels/${encodeURIComponent(target.channel_id)}/messages`;
const payload = result => JSON.parse(result.content[0].text);
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
function reader(responses = [], conn = connection) {
  const requests = []; let tokens = 0;
  const instance = teams.createTeamsReader({ getConnection: async () => conn, getToken: async () => { tokens++; return 'test-token'; },
    fetcher: async (url, options) => { requests.push({ url, options }); const result = responses.shift(); if (!result) throw new Error('unexpected request'); return result; } });
  return { instance, requests, tokens: () => tokens };
}
test('owner, tenant, Microsoft identity and missing scope fail before token or Graph access', async () => {
  for (const [who, conn] of [['other', connection], [owner, { ...connection, tenant_id: 'other' }], [owner, { ...connection, microsoft_user_id: 'other' }], [owner, { ...connection, granted_scopes: [] }]]) {
    const r = reader([], conn); await assert.rejects(r.instance.posts(who, {}));
    assert.equal(r.tokens(), 0); assert.equal(r.requests.length, 0);
  }
});
test('status reports scope only and never asserts content retrieval', async () => {
  const r = reader(); const status = payload(await r.instance.status(owner));
  assert.equal(status.permission_granted, true); assert.equal(status.content_read_verified, false); assert.equal(r.tokens(), 0);
});
test('pagination preserves incomplete state and channel context, with GET only', async () => {
  const next = `https://graph.microsoft.com${root}?$skiptoken=opaque&$top=25`;
  const r = reader([json({ value: [{ id: '1', body: { content: 'Visitor' } }], '@odata.nextLink': next }), json({ value: [{ id: '2' }] })]);
  const first = payload(await r.instance.posts(owner, {})); assert.equal(first.complete, false); assert.equal(first.next_cursor, next);
  const second = payload(await r.instance.posts(owner, { cursor: first.next_cursor })); assert.equal(second.complete, true); assert.equal(second.posts[0].id, '2');
  for (const request of r.requests) { assert.equal(request.options.method, 'GET'); assert.equal(request.options.redirect, 'error'); assert.ok(request.url.startsWith(`https://graph.microsoft.com${root}`)); }
});
test('cross-channel, external, oversized and query-expanded cursors are rejected', () => {
  for (const cursor of [`https://evil.example${root}`, `https://graph.microsoft.com${root.replace(target.team_id, 'other')}`, `https://graph.microsoft.com${root}?$expand=members`, `https://graph.microsoft.com${root}?$top=999`, `https://user@graph.microsoft.com${root}`, `https://graph.microsoft.com${root}?$top=1&$top=999`]) assert.throws(() => teams.collectionUrl(root, cursor));
  assert.ok(teams.collectionUrl(root, `https://graph.microsoft.com${decodeURIComponent(root)}?$skiptoken=abc`));
});
test('thread keeps root/reply identity and reply pagination', async () => {
  const next = `https://graph.microsoft.com${root}/1/replies?$skiptoken=opaque`;
  const r = reader([json({ id: '1' }), json({ value: [{ id: '2', replyToId: '1' }], '@odata.nextLink': next })]);
  const result = payload(await r.instance.thread(owner, { post_id: '1' }));
  assert.equal(result.post.id, '1'); assert.equal(result.replies[0].reply_to_id, '1'); assert.equal(result.complete, false);
  assert.equal(r.requests[1].url, `https://graph.microsoft.com${root}/1/replies?$top=25`);
});
test('hosted media listing uses documented endpoint without unsupported top parameter', async () => {
  const r = reader([json({ value: [{ id: 'media', contentBytes: 'SHOULD_NOT_LEAK' }] })]);
  const result = payload(await r.instance.mediaList(owner, { post_id: '1', reply_id: '2' }));
  assert.equal(r.requests[0].url, `https://graph.microsoft.com${root}/1/replies/2/hostedContents`);
  assert.equal(result.hosted_contents[0].id, 'media'); assert.ok(!JSON.stringify(result).includes('SHOULD_NOT_LEAK'));
});
test('binary images and audio become MCP blocks with explicit untranscribed status', async () => {
  for (const [mime, type] of [['image/png', 'image'], ['audio/ogg', 'audio']]) {
    const r = reader([new Response(new Uint8Array([1,2,3]), { headers: { 'content-type': mime } })]);
    const result = await r.instance.media(owner, { post_id: '1', reply_id: '2', content_id: 'a/b+=' });
    assert.equal(result.content[1].type, type); assert.equal(result.content[1].data, 'AQID');
    assert.equal(r.requests[0].url, `https://graph.microsoft.com${root}/1/replies/2/hostedContents/a%2Fb%2B%3D/$value`);
    assert.equal(payload(result).transcription_status, type === 'audio' ? 'not_transcribed' : 'not_applicable');
  }
});
test('invalid IDs, MIME, declared and streamed oversized content fail', async () => {
  await assert.rejects(reader().instance.media(owner, { post_id: '../other', content_id: 'x' }));
  await assert.rejects(reader().instance.media(owner, { post_id: '1', reply_id: 0, content_id: 'x' }));
  await assert.rejects(reader().instance.media(owner, { post_id: '1', content_id: '..' }));
  for (const response of [new Response('x', { headers: { 'content-type': 'text/html' } }),
    new Response('x', { headers: { 'content-type': 'image/png', 'content-length': '99999999' } }),
    new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { 'content-type': 'audio/ogg' } })]) {
    await assert.rejects(reader([response]).instance.media(owner, { post_id: '1', content_id: 'x' }));
  }
});
test('Graph failure does not leak response content or token', async () => {
  await assert.rejects(reader([new Response('secret-url-and-token', { status: 403 })]).instance.posts(owner, {}), error => /403/.test(error.message) && !/secret/.test(error.message));
});
test('refresh preserves optional consent and ordinary connection does not request it', () => {
  const base = 'openid offline_access User.Read Mail.Read';
  assert.equal(teams.scopesFor(base, {}), base);
  assert.equal(teams.scopesFor(base, connection), `${base} ${teams.TEAMS_SCOPE}`);
  assert.equal(teams.scopesFor(base, {}, true), `${base} ${teams.TEAMS_SCOPE}`);
});

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
function app(additions = {}) {
  let handler;
  const context = vm.createContext({ ...teams, Request, Response, URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto, atob, btoa, console, fetch: async () => { throw new Error('unexpected network'); },
    Deno: { env: { get: key => ({ SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test', MS_ASSISTANT_TENANT_ID: target.tenant_id, MS_ASSISTANT_CLIENT_ID: 'client', MS_ASSISTANT_CLIENT_SECRET: 'test' })[key] }, serve: fn => { handler = fn; } }, ...additions });
  vm.runInContext(stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, ''), { mode: 'strip' }), context);
  return { context, handler, evaluate: code => vm.runInContext(code, context) };
}
test('existing 19 tool schemas retained with only optional consent fields added', () => {
  const server = app(); const actual = JSON.parse(server.evaluate('JSON.stringify(tools)'));
  const expected = JSON.parse(readFileSync(new URL('./legacy-catalog.json', import.meta.url), 'utf8'));
  assert.equal(actual.length, expected.length + teams.teamsTools.length);
  assert.equal(new Set(actual.map(x => x.name)).size, actual.length);
  for (const old of expected) {
    const current = actual.find(x => x.name === old.name);
    if (old.name !== 'begin_calendar_connection') assert.deepEqual(current.inputSchema, old.inputSchema);
    else assert.equal(current.inputSchema.required, undefined);
  }
  assert.equal(server.evaluate('GRAPH_SCOPES'), 'openid profile email offline_access User.Read Calendars.Read Calendars.ReadWrite Mail.Read Mail.ReadWrite');
});
test('MCP auth and old/new consent guards remain enforced', async () => {
  const server = app();
  assert.equal((await server.handler(new Request('https://example.supabase.co/functions/v1/lef-microsoft365-oauth', { method: 'POST', body: '{}' }))).status, 401);
  for (const name of ['create_calendar_block', 'create_reply_draft', 'begin_teams_channel_connection']) await assert.rejects(server.evaluate(`callTool('${name}', {}, {id:'${owner}'})`), /confirmation/);
  await assert.rejects(server.evaluate(`callTool('begin_calendar_connection', {include_teams_channel_read:true}, {id:'${owner}'})`), /confirmation/);
});
test('consent URL preserves base permissions and only adds Teams when requested', async () => {
  const server = app(); server.context.db = async () => [];
  server.context.ownConnection = async () => ({ ...connection, granted_scopes: ['Mail.Read'] });
  const base = await server.evaluate(`beginConnection('${owner}')`);
  assert.ok(!new URL(base.authorization_url).searchParams.get('scope').includes(teams.TEAMS_SCOPE));
  const extended = await server.evaluate(`beginConnection('${owner}', true)`);
  assert.ok(new URL(extended.authorization_url).searchParams.get('scope').includes(teams.TEAMS_SCOPE));
  assert.ok(new URL(extended.authorization_url).searchParams.get('code_challenge'));
});
test('OAuth callback redeems original request scope and rejects wrong Teams account before persistence', async () => {
  const server = app(); let writes = 0; let redemption;
  server.context.db = async (path, init) => {
    if (path.startsWith('microsoft365_oauth_states')) return [{ owner_user_id: owner, redirect_uri: 'callback', code_verifier: 'pkce' }];
    if (init?.method) writes++;
    return [connection];
  };
  server.context.tokenRequest = async args => { redemption = args; return { refresh_token: 'test', access_token: 'test', scope: teams.TEAMS_SCOPE }; };
  server.context.graph = async () => ({ id: 'wrong-account' });
  const response = await server.evaluate(`callback(new URL('https://example/callback?code=code&state=state'))`);
  assert.equal(response.status, 400); assert.equal(redemption.scope, undefined); assert.equal(writes, 0);
});
test('MCP media blocks survive outer handler without being serialized as text', async () => {
  const media = { content: [{ type: 'image', mimeType: 'image/png', data: 'AQID' }], isError: false };
  const server = app({ createTeamsReader: () => ({ media: async () => media }) });
  server.context.authenticate = async () => ({ id: owner });
  const response = await server.handler(new Request('https://example.supabase.co/functions/v1/lef-microsoft365-oauth', {
    method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'read_teams_channel_media', arguments: { post_id: '1', content_id: 'x' } } }) }));
  assert.deepEqual((await response.json()).result, media);
});
test('token refresh requests previously approved Teams permission without changing owner scope', async () => {
  const server = app(); let requested; const writes = [];
  server.context.ownConnection = async () => ({ ...connection, id: 'connection-id' });
  server.context.db = async (path, init) => { if (init?.method) writes.push(path); return [{ encrypted_refresh_token: 'test', encryption_iv: 'test' }]; };
  server.context.decryptToken = async () => 'refresh'; server.context.encryptToken = async () => ({ encrypted_refresh_token: 'new', encryption_iv: 'new' });
  server.context.tokenRequest = async args => { requested = args; return { access_token: 'access', scope: `Mail.Read ${teams.TEAMS_SCOPE}` }; };
  assert.equal(await server.evaluate(`accessToken('${owner}')`), 'access');
  assert.ok(requested.scope.includes(teams.TEAMS_SCOPE));
  assert.ok(writes.every(path => path.includes(`owner_user_id=eq.${owner}`)));
});
