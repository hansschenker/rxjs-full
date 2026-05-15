import { get } from './router';
import { json } from './response';
import { createHttpTestClient, createTestRequest, runRequest } from './testing';

describe('testing helpers', () => {
	it('runs routes in memory', async () => {
		const res = await runRequest([
			get('/ping', req$ => req$.pipe(map(() => json({ ok: true })))),
		], createTestRequest({ url: '/ping' }));
		expect(res.body).toEqual({ ok: true });
	});

	it('builds an HTTP test client', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
		const client = createHttpTestClient('http://localhost:3000');
		await client.post('/todos', { title: 'test' });
		expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/todos', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ title: 'test' }),
		}));
		fetchSpy.mockRestore();
	});
});

import { map } from 'rxjs/operators';
import { vi } from 'vitest';
