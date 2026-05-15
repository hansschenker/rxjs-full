import { createServer as createNetServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { createApp } from './core/app';
import { del, get, group, post, put } from './core/router';
import { createTodoStore } from './todos/todo.store';
import { createTodoEffects } from './todos/todo.effect';

const getAvailablePort = (): Promise<number> =>
	new Promise(resolve => {
		const server = createNetServer();
		server.listen(0, () => {
			const { port } = server.address() as AddressInfo;
			server.close(() => resolve(port));
		});
	});

describe('HTTP integration', () => {
	let port: number;
	let app: ReturnType<typeof createApp<{ todoStore: ReturnType<typeof createTodoStore> }>>;
	let store: ReturnType<typeof createTodoStore>;

	beforeAll(async () => {
		port = await getAvailablePort();
		store = createTodoStore();
		const effects = createTodoEffects();
		app = createApp([
			group('/todos', [
				get('/', effects.getAll$),
				post('/', effects.create$),
				put('/:id', effects.update$),
				del('/:id', effects.delete$),
			]),
		], { services: { todoStore: store } });
		await app.start(port);
	});

	afterAll(async () => app.stop());
	beforeEach(() => store.reset());

	const url = (path: string): string => `http://127.0.0.1:${port}${path}`;

	it('returns 400 for malformed JSON', async () => {
		const res = await fetch(url('/todos'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{"title":',
		});

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: 'Malformed JSON' });
	});

	it('returns 413 when the request body exceeds the limit', async () => {
		const res = await fetch(url('/todos'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'x'.repeat(1024 * 1024) }),
		});

		expect(res.status).toBe(413);
		await expect(res.json()).resolves.toEqual({ error: 'Request body too large' });
	});

	it('returns 404 when updating a missing todo', async () => {
		const res = await fetch(url('/todos/missing'), {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ completed: true }),
		});

		expect(res.status).toBe(404);
		await expect(res.json()).resolves.toEqual({ error: 'Todo not found' });
	});

	it('returns 404 when deleting a missing todo', async () => {
		const res = await fetch(url('/todos/missing'), { method: 'DELETE' });

		expect(res.status).toBe(404);
		await expect(res.json()).resolves.toEqual({ error: 'Todo not found' });
	});
});
