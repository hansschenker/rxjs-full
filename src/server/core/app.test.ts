import { firstValueFrom, of } from 'rxjs';
import { createApp } from './app';
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

import { map } from 'rxjs/operators';
