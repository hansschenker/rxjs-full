import { expectTypeOf, vi } from 'vitest';
import { of, firstValueFrom } from 'rxjs';

vi.mock('rxjs/fetch', () => ({
	fromFetch: vi.fn(),
}));

import { fromFetch } from 'rxjs/fetch';
import { createClient } from './api';
import { routes } from '../shared/routes';
import type { CreateTodoBody, Todo, UpdateTodoBody } from '../shared/types';

const mockFromFetch = vi.mocked(fromFetch);
const fakeRes = (data: unknown): Response =>
	({ json: () => Promise.resolve(data) }) as unknown as Response;

describe('createClient()', () => {
	it('derives callable client methods from the route tree', async () => {
		const client = createClient(routes);
		const todo: Todo = { id: '1', title: 'Test', completed: false, createdAt: '2026-01-01T00:00:00.000Z' };
		mockFromFetch.mockReturnValue(of(fakeRes(todo)));

		const result = await firstValueFrom(client.todos.create({ title: 'Test' }));

		expect(mockFromFetch).toHaveBeenCalledWith('/api/todos', expect.objectContaining({
			method: 'POST',
			body: JSON.stringify({ title: 'Test' }),
		}));
		expect(result).toEqual(todo);
	});

	it('preserves method signatures from contracts', () => {
		const client = createClient(routes);
		expectTypeOf(client.todos.list).toEqualTypeOf<() => import('rxjs').Observable<Todo[]>>();
		expectTypeOf(client.todos.create).toEqualTypeOf<(body: CreateTodoBody) => import('rxjs').Observable<Todo>>();
		expectTypeOf(client.todos.update).toEqualTypeOf<(params: { id: string }, body: UpdateTodoBody) => import('rxjs').Observable<Todo>>();
		expectTypeOf(client.todos.remove).toEqualTypeOf<(params: { id: string }) => import('rxjs').Observable<void>>();
	});
});
