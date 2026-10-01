const MARKER = 'SERVERLESS_BUILD_KV_CONFIG_JAVASCRIPT_V1';
const CACHE_TTL = 60;
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method !== 'GET')
            return Response.json({ error: 'This public configuration demo is read-only. Seed changes through Wrangler.' }, { status: 405, headers: { allow: 'GET' } });
        if (url.pathname === '/health')
            return Response.json({ ok: true, marker: MARKER });
        if (url.pathname === '/')
            return Response.json({ marker: MARKER, pattern: 'Read-heavy application configuration in Workers KV',
                endpoints: ['GET /config?version=v1', 'GET /evaluate?version=v1&plan=pro&region=EU', 'GET /health'],
                versions: ['v1', 'v2'], notes: 'Configuration is seeded by the operator, cached at each location, and eventually consistent. Feature flags are not authorization.' });
        if (!['/config', '/evaluate'].includes(url.pathname))
            return Response.json({ error: 'Not found' }, { status: 404 });
        const version = url.searchParams.get('version') ?? 'v1';
        if (!['v1', 'v2'].includes(version))
            return Response.json({ error: 'Choose version v1 or v2' }, { status: 400 });
        const plan = url.searchParams.get('plan') ?? 'free';
        const region = url.searchParams.get('region') ?? 'EU';
        if (!['free', 'pro', 'enterprise'].includes(plan) || !['NA', 'EU', 'APAC'].includes(region))
            return Response.json({ error: 'Choose plan free/pro/enterprise and region NA/EU/APAC' }, { status: 400 });
        const key = `app-config:${version}`;
        const stored = await env.KV.getWithMetadata(key, { type: 'json', cacheTtl: CACHE_TTL });
        if (!stored.value)
            return Response.json({ error: 'Configuration is not seeded yet. Run npm run seed:local or seed:remote.', key }, { status: 503 });
        const config = stored.value;
        const common = { marker: MARKER, key, revision: config.revision, metadata: stored.metadata, cacheTtlSeconds: CACHE_TTL,
            consistency: 'Eventually consistent; cacheTtl is a configured policy, not a measured hit or propagation time.' };
        const body = url.pathname === '/config' ? { ...common, config }
            : { ...common, demoInputs: { plan, region }, fastSearchEnabled: config.fastSearch.enabled && config.fastSearch.plans.includes(plan) && config.fastSearch.regions.includes(region),
                note: 'Caller-selected plan and region illustrate a UI feature rule; they do not grant access to protected resources.' };
        return Response.json(body, { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
    },
};
