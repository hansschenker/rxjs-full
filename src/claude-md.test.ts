// Validates every code example in CLAUDE.md.
// If these tests break, the documentation is out of date.

import { firstValueFrom, of } from 'rxjs';
import { expectTypeOf, vi } from 'vitest';

vi.mock('rxjs/fetch', () => ({ fromFetch: vi.fn() }));

import { fromFetch } from 'rxjs/fetch';
import { apiPath, routes, type RouteParams, type RouteBody, type RouteResponse } from './shared/routes';
import type { Todo, CreateTodoBody, UpdateTodoBody } from './shared/types';
import { createClient } from './client/api';
import { createTestContext, createTestRequest, runRequest } from './server/core/testing';
import { createTodoEffects } from './server/todos/todo.effect';
import { createTodoStore } from './server/todos/todo.store';
import { handle } from './server/core/router';

// ---------------------------------------------------------------------------
// Shared route contracts
// ---------------------------------------------------------------------------

describe('CLAUDE.md — shared route contracts', () => {
	it('apiPath builds /api/todos/42 from the update route', () => {
		expect(apiPath(routes.todos.update.path, { id: '42' })).toBe('/api/todos/42');
	});

	it('RouteParams<update.path> is { id: string }', () => {
		expectTypeOf<RouteParams<typeof routes.todos.update.path>>().toEqualTypeOf<{ id: string }>();
	});

	it('RouteBody<create> is CreateTodoBody', () => {
		expectTypeOf<RouteBody<typeof routes.todos.create>>().toEqualTypeOf<CreateTodoBody>();
	});

	it('RouteResponse<create> is Todo', () => {
		expectTypeOf<RouteResponse<typeof routes.todos.create>>().toEqualTypeOf<Todo>();
	});
});

// ---------------------------------------------------------------------------
// Generated typed client  (createClient)
// ---------------------------------------------------------------------------

const mockFetch = vi.mocked(fromFetch);
const fakeResponse = (data: unknown): Response =>
	({ json: () => Promise.resolve(data) }) as unknown as Response;

describe('CLAUDE.md — createClient(routes)', () => {
	const api = createClient(routes);

	it('api.todos.list() sends GET /api/todos and returns Todo[]', async () => {
		const todos: Todo[] = [
			{ id: '1', title: 'One', completed: false, createdAt: '2026-01-01T00:00:00.000Z' },
		];
		mockFetch.mockReturnValue(of(fakeResponse(todos)));

		const result = await firstValueFrom(api.todos.list({}));

		expect(mockFetch).toHaveBeenCalledWith('/api/todos', expect.objectContaining({ method: 'GET' }));
		expect(result).toEqual(todos);
	});

	it('api.todos.list(query) appends query string', async () => {
		mockFetch.mockReturnValue(of(fakeResponse([])));

		await firstValueFrom(api.todos.list({ completed: 'true' }));

		expect(mockFetch).toHaveBeenCalledWith('/api/todos?completed=true', expect.any(Object));
	});

	it('api.todos.create({ title }) sends POST and returns the new Todo', async () => {
		const todo: Todo = { id: '2', title: 'Ship it', completed: false, createdAt: '2026-01-01T00:00:00.000Z' };
		mockFetch.mockReturnValue(of(fakeResponse(todo)));

		const result = await firstValueFrom(api.todos.create({ title: 'Ship it' }));

		expect(mockFetch).toHaveBeenCalledWith('/api/todos', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ title: 'Ship it' }),
		}));
		expect(result).toEqual(todo);
	});

	it('api.todos.update({ id }, body) sends PUT /api/todos/:id', async () => {
		const todo: Todo = { id: '42', title: 'Ship it', completed: true, createdAt: '2026-01-01T00:00:00.000Z' };
		mockFetch.mockReturnValue(of(fakeResponse(todo)));

		const result = await firstValueFrom(api.todos.update({ id: '42' }, { completed: true }));

		expect(mockFetch).toHaveBeenCalledWith('/api/todos/42', expect.objectContaining({
			method: 'PUT',
			body: JSON.stringify({ completed: true }),
		}));
		expect(result).toEqual(todo);
	});

	it('api.todos.remove({ id }) sends DELETE /api/todos/:id', async () => {
		mockFetch.mockReturnValue(of(new Response(null, { status: 204 })));

		await firstValueFrom(api.todos.remove({ id: '42' }));

		expect(mockFetch).toHaveBeenCalledWith('/api/todos/42', expect.objectContaining({ method: 'DELETE' }));
	});

	it('method signatures match the route contracts', () => {
		expectTypeOf(api.todos.list).toEqualTypeOf<
			(query: { completed?: 'true' | 'false' }) => import('rxjs').Observable<Todo[]>
		>();
		expectTypeOf(api.todos.create).toEqualTypeOf<
			(body: CreateTodoBody) => import('rxjs').Observable<Todo>
		>();
		expectTypeOf(api.todos.update).toEqualTypeOf<
			(params: { id: string }, body: UpdateTodoBody) => import('rxjs').Observable<Todo>
		>();
		expectTypeOf(api.todos.remove).toEqualTypeOf<
			(params: { id: string }) => import('rxjs').Observable<void>
		>();
	});
});

// ---------------------------------------------------------------------------
// Testing patterns — runRequest + createTestRequest + createTestContext
// ---------------------------------------------------------------------------

describe('CLAUDE.md — testing patterns', () => {
	const todoStore = createTodoStore();
	const effects = createTodoEffects();
	const todoRoutes = [
		handle(routes.todos.list,   effects.getAll$),
		handle(routes.todos.create, effects.create$),
		handle(routes.todos.update, effects.update$),
		handle(routes.todos.remove, effects.delete$),
	];

	beforeEach(() => todoStore.reset());

	it('runRequest + createTestRequest + createTestContext creates a new todo', async () => {
		const res = await runRequest(
			todoRoutes,
			createTestRequest({
				method: 'POST',
				url: '/todos',
				body: { title: 'Test' },
				context: createTestContext({ todoStore }),
			}),
		);

		expect(res.status).toBe(201);
		expect((res.body as { title: string }).title).toBe('Test');
	});

	it('runRequest + createTestRequest reads all todos through the router', async () => {
		const res = await runRequest(
			todoRoutes,
			createTestRequest({ url: '/todos', context: createTestContext({ todoStore }) }),
		);

		expect(res.status).toBe(200);
		expect(Array.isArray(res.body)).toBe(true);
	});

	it('createTestContext injects services accessible to effects', async () => {
		todoStore.setTodos([
			{ id: '99', title: 'Injected', completed: false, createdAt: '2026-01-01T00:00:00.000Z' },
		]);

		const res = await runRequest(
			todoRoutes,
			createTestRequest({ url: '/todos', context: createTestContext({ todoStore }) }),
		);

		expect((res.body as Todo[]).find(t => t.id === '99')).toBeDefined();
	});

	it('router returns 404 for unmatched routes', async () => {
		const res = await runRequest(
			todoRoutes,
			createTestRequest({ url: '/unknown', context: createTestContext({ todoStore }) }),
		);

		expect(res.status).toBe(404);
	});
});
