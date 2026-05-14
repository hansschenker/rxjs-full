import { firstValueFrom, of, throwError } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { createRouter } from './router';
import { ValidationError } from './validator';
import type { HttpRequest } from './types';
import type * as http from 'http';

const mockReq = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
	method: 'GET',
	url: '/',
	params: {},
	query: {},
	body: {},
	headers: {},
	raw: {} as http.IncomingMessage,
	...overrides,
});

describe('createRouter()', () => {
	it('matches a route by method and exact path', async () => {
		const router = createRouter([
			{ method: 'GET', path: '/', effect: req$ => req$.pipe(map(() => ({ body: 'home' }))) },
		]);
		const res = await firstValueFrom(router(of(mockReq())));
		expect(res.body).toBe('home');
	});

	it('returns 404 when no routes are registered', async () => {
		const router = createRouter([]);
		const res = await firstValueFrom(router(of(mockReq())));
		expect(res.status).toBe(404);
	});

	it('returns 404 when method does not match', async () => {
		const router = createRouter([
			{ method: 'POST', path: '/', effect: req$ => req$.pipe(map(() => ({ body: 'ok' }))) },
		]);
		const res = await firstValueFrom(router(of(mockReq({ method: 'GET' }))));
		expect(res.status).toBe(404);
	});

	it('returns 404 when path does not match', async () => {
		const router = createRouter([
			{ method: 'GET', path: '/other', effect: req$ => req$.pipe(map(() => ({ body: 'ok' }))) },
		]);
		const res = await firstValueFrom(router(of(mockReq({ url: '/todos' }))));
		expect(res.status).toBe(404);
	});

	it('extracts a single path param', async () => {
		const router = createRouter([
			{ method: 'GET', path: '/todos/:id', effect: req$ => req$.pipe(map(req => ({ body: req.params.id }))) },
		]);
		const res = await firstValueFrom(router(of(mockReq({ url: '/todos/42' }))));
		expect(res.body).toBe('42');
	});

	it('extracts multiple path params', async () => {
		const router = createRouter([
			{ method: 'GET', path: '/users/:userId/posts/:postId', effect: req$ => req$.pipe(map(req => ({ body: req.params }))) },
		]);
		const res = await firstValueFrom(router(of(mockReq({ url: '/users/1/posts/99' }))));
		expect(res.body).toEqual({ userId: '1', postId: '99' });
	});

	it('matches the first route when multiple could match', async () => {
		const router = createRouter([
			{ method: 'GET', path: '/todos', effect: req$ => req$.pipe(map(() => ({ body: 'first' }))) },
			{ method: 'GET', path: '/todos', effect: req$ => req$.pipe(map(() => ({ body: 'second' }))) },
		]);
		const res = await firstValueFrom(router(of(mockReq({ url: '/todos' }))));
		expect(res.body).toBe('first');
	});

	it('returns 422 when effect throws ValidationError', async () => {
		const router = createRouter([
			{
				method: 'GET', path: '/',
				effect: req$ => req$.pipe(mergeMap(() => throwError(() => new ValidationError([])))),
			},
		]);
		const res = await firstValueFrom(router(of(mockReq())));
		expect(res.status).toBe(422);
	});

	it('returns 500 when effect throws an unexpected error', async () => {
		const router = createRouter([
			{
				method: 'GET', path: '/',
				effect: req$ => req$.pipe(mergeMap(() => throwError(() => new Error('boom')))),
			},
		]);
		const res = await firstValueFrom(router(of(mockReq())));
		expect(res.status).toBe(500);
	});

	it('does not confuse /todos with /todos/:id', async () => {
		const router = createRouter([
			{ method: 'GET', path: '/todos',     effect: req$ => req$.pipe(map(() => ({ body: 'list' }))) },
			{ method: 'GET', path: '/todos/:id', effect: req$ => req$.pipe(map(req => ({ body: req.params.id }))) },
		]);
		const list = await firstValueFrom(router(of(mockReq({ url: '/todos' }))));
		const item = await firstValueFrom(router(of(mockReq({ url: '/todos/5' }))));
		expect(list.body).toBe('list');
		expect(item.body).toBe('5');
	});
});
