import { firstValueFrom, of } from 'rxjs';
import { vi } from 'vitest';
import { logger } from './middleware';
import type { HttpRequest } from './types';
import type * as http from 'http';

const mockReq = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
	method: 'GET',
	url: '/test',
	params: {},
	query: {},
	body: {},
	headers: {},
	raw: {} as http.IncomingMessage,
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
});
