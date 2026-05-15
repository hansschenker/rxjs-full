import { firstValueFrom, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { vi } from 'vitest';
import { cors, logger, requestId, requireAuth } from './middleware';
import type { Effect, HttpRequest, HttpResponse } from './types';
import type * as http from 'http';

const mockReq = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
	method: 'GET',
	url: '/test',
	params: {},
	query: {},
	body: {},
	headers: {},
	raw: {} as http.IncomingMessage,
	context: { services: {}, state: {} },
	requestContext: { state: {} },
	...overrides,
});

describe('logger()', () => {
	it('passes the request through unchanged', async () => {
		const req = mockReq();
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const result = await firstValueFrom(of(req).pipe(logger()));
		expect(result).toBe(req);
		vi.restoreAllMocks();
	});

	it('logs method and url', async () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		await firstValueFrom(of(mockReq({ method: 'POST', url: '/todos' })).pipe(logger()));
		expect(spy).toHaveBeenCalledWith('POST /todos');
		spy.mockRestore();
	});

	it('logs each request in the stream', async () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		const req1 = mockReq({ method: 'GET', url: '/a' });
		const req2 = mockReq({ method: 'DELETE', url: '/b' });
		const { toArray } = await import('rxjs/operators');
		const { of: rxOf } = await import('rxjs');
		await firstValueFrom(rxOf(req1, req2).pipe(logger(), toArray()));
		expect(spy).toHaveBeenCalledWith('GET /a');
		expect(spy).toHaveBeenCalledWith('DELETE /b');
		spy.mockRestore();
	});

	it('adds a request id to request-scoped context', async () => {
		const req = await firstValueFrom(of(mockReq()).pipe(requestId()));
		expect(req.requestContext.requestId).toEqual(expect.any(String));
	});
});

describe('cors()', () => {
	const makeEffect = (response: HttpResponse): Effect =>
		req$ => req$.pipe(map(() => response));

	it('adds Access-Control-Allow-Origin: * to responses by default', async () => {
		const wrapped = cors()(makeEffect({ status: 200, body: 'ok' }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: {} }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
	});

	it('returns 204 for OPTIONS preflight with CORS headers', async () => {
		const wrapped = cors()(makeEffect({ status: 200, body: 'ok' }));
		const res = await firstValueFrom(wrapped(of(mockReq({ method: 'OPTIONS', headers: {} }))));
		expect(res.status).toBe(204);
		expect(res.headers?.['Access-Control-Allow-Methods']).toContain('GET');
		expect(res.headers?.['Access-Control-Allow-Headers']).toContain('Content-Type');
		expect(res.headers?.['Access-Control-Max-Age']).toBe('86400');
	});

	it('does not call the wrapped effect for OPTIONS requests', async () => {
		const effectSpy = vi.fn((_req$: Observable<HttpRequest>) => of({ status: 200 } as HttpResponse));
		const wrapped = cors()(effectSpy as unknown as Effect);
		await firstValueFrom(wrapped(of(mockReq({ method: 'OPTIONS', headers: {} }))));
		expect(effectSpy).not.toHaveBeenCalled();
	});

	it('echoes a matching origin from the allowlist', async () => {
		const wrapped = cors({ origins: ['http://localhost:5173'] })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://localhost:5173' } }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
	});

	it('omits Access-Control-Allow-Origin for a non-matching origin', async () => {
		const wrapped = cors({ origins: ['http://localhost:5173'] })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://evil.com' } }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
	});

	it('adds Access-Control-Allow-Credentials when credentials is true', async () => {
		const wrapped = cors({ credentials: true, origins: ['http://localhost:5173'] })(
			makeEffect({ status: 200 }),
		);
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://localhost:5173' } }))));
		expect(res.headers?.['Access-Control-Allow-Credentials']).toBe('true');
	});

	it('echoes the request origin instead of * when credentials is true', async () => {
		const wrapped = cors({ credentials: true })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://localhost:5173' } }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
	});

	it('does not override existing response headers', async () => {
		const wrapped = cors()(makeEffect({ status: 200, headers: { 'X-Custom': 'value' } }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: {} }))));
		expect(res.headers?.['X-Custom']).toBe('value');
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
	});

	it('respects a custom maxAge', async () => {
		const wrapped = cors({ maxAge: 3600 })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ method: 'OPTIONS', headers: {} }))));
		expect(res.headers?.['Access-Control-Max-Age']).toBe('3600');
	});
});

describe('requireAuth()', () => {
	const makeEffect = (response: HttpResponse): Effect =>
		req$ => req$.pipe(map(() => response));

	const okEffect = makeEffect({ status: 200, body: 'ok' });

	it('passes the request through when the token is valid', async () => {
		const verify = vi.fn().mockResolvedValue({ id: '42' });
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Bearer valid-token' } }))),
		);
		expect(res.status).toBe(200);
		expect(verify).toHaveBeenCalledWith('valid-token');
	});

	it('stores claims in requestContext.state.user', async () => {
		const claims = { id: '42', role: 'admin' };
		let captured: unknown;
		const captureEffect: Effect = req$ =>
			req$.pipe(map(req => {
				captured = req.requestContext.state.user;
				return { status: 200 };
			}));
		const wrapped = requireAuth(vi.fn().mockResolvedValue(claims))(captureEffect);
		await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Bearer t' } }))),
		);
		expect(captured).toEqual(claims);
	});

	it('returns 401 when Authorization header is missing', async () => {
		const wrapped = requireAuth(vi.fn())(okEffect);
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: {} }))));
		expect(res.status).toBe(401);
	});

	it('returns 401 when Authorization header is not Bearer format', async () => {
		const wrapped = requireAuth(vi.fn())(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }))),
		);
		expect(res.status).toBe(401);
	});

	it('returns 401 (not 500) when verify throws', async () => {
		const verify = vi.fn().mockRejectedValue(new Error('invalid signature'));
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Bearer bad-token' } }))),
		);
		expect(res.status).toBe(401);
	});

	it('bypasses auth for paths in the explicit exclude list', async () => {
		const verify = vi.fn();
		const wrapped = requireAuth(verify, { exclude: ['/login'] })(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ url: '/login', headers: {} }))),
		);
		expect(res.status).toBe(200);
		expect(verify).not.toHaveBeenCalled();
	});

	it('bypasses auth for /health by default', async () => {
		const verify = vi.fn();
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ url: '/health', headers: {} }))),
		);
		expect(res.status).toBe(200);
		expect(verify).not.toHaveBeenCalled();
	});

	it('bypasses auth for /ready by default', async () => {
		const verify = vi.fn();
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ url: '/ready', headers: {} }))),
		);
		expect(res.status).toBe(200);
		expect(verify).not.toHaveBeenCalled();
	});
});
