import { firstValueFrom, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { createApp } from './app';
import { cors, requireAuth } from './middleware';
import { createRouter, get, group } from './router';
import { json } from './response';
import { createTestRequest } from './testing';

describe('createApp()', () => {
	it('adds health routes by default', async () => {
		const app = createApp([]);
		const router = createRouter(app.routes, app.context);
		const res = await firstValueFrom(router(of(createTestRequest({ url: '/health' }))));
		expect(res.body).toEqual({ status: 'ok' });
	});

	it('runs lifecycle hooks with the app context', async () => {
		const calls: string[] = [];
		const app = createApp([], {
			services: { name: 'test' },
			onStart: [context => { calls.push(`start:${context.services.name}`); }],
			onStop: [context => { calls.push(`stop:${context.services.name}`); }],
		});

		await app.start(0);
		await app.stop();

		expect(calls).toEqual(['start:test', 'stop:test']);
	});
});

describe('route groups', () => {
	it('apply prefixes and group middleware', async () => {
		const router = createRouter([
			group('/api', [
				get('/items', req$ => req$.pipe(map(req => json(req.headers['x-group'])))),
			], source$ => source$.pipe(map(req => ({
				...req,
				headers: { ...req.headers, 'x-group': 'applied' },
			})))),
		]);

		const res = await firstValueFrom(router(of(createTestRequest({ url: '/api/items' }))));
		expect(res.body).toBe('applied');
	});

	it('support nested prefixes', async () => {
		const router = createRouter([
			group('/api', [
				group('/v1', [
					get('/items', req$ => req$.pipe(map(() => json('nested')))),
				]),
			]),
		]);

		const res = await firstValueFrom(router(of(createTestRequest({ url: '/api/v1/items' }))));
		expect(res.body).toBe('nested');
	});
});

describe('createApp() — cors option', () => {
	it('applies the cors wrapper so OPTIONS requests receive preflight headers', async () => {
		const app = createApp([
			get('/test', req$ => req$.pipe(map(() => json('ok')))),
		], { cors: cors() });

		const res = await firstValueFrom(app.router(of(createTestRequest({
			method: 'OPTIONS',
			url: '/test',
			headers: {},
		}))));

		expect(res.status).toBe(204);
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
	});

	it('leaves the router unwrapped when no cors option is given', async () => {
		const app = createApp([
			get('/test', req$ => req$.pipe(map(() => json('ok')))),
		]);

		const res = await firstValueFrom(app.router(of(createTestRequest({ url: '/test' }))));
		expect(res.status).toBe(200);
		expect(res.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
	});
});

describe('createApp() — auth option', () => {
	const testRoutes = [
		get('/secret', req$ => req$.pipe(map(() => json('classified')))),
	];

	it('returns 401 when no token is provided', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({ url: '/secret', headers: {} }))),
		);
		expect(res.status).toBe(401);
	});

	it('returns 200 when a valid token is provided', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({
				url: '/secret',
				headers: { authorization: 'Bearer valid' },
			}))),
		);
		expect(res.status).toBe(200);
	});

	it('cors + auth — OPTIONS preflight bypasses auth', async () => {
		const app = createApp(testRoutes, {
			cors: cors(),
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({
				method: 'OPTIONS',
				url: '/secret',
				headers: {},
			}))),
		);
		expect(res.status).toBe(204);
	});

	it('/health bypasses auth by default', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({ url: '/health', headers: {} }))),
		);
		expect(res.status).toBe(200);
	});
});
