import { expectTypeOf } from 'vitest';
import { apiPath, buildPath, routes, type RouteBody, type RouteParams, type RouteResponse } from './routes';
import type { CreateTodoBody, Todo } from './types';

describe('shared routes', () => {
	it('builds concrete paths from typed route params', () => {
		expect(buildPath(routes.todos.update.path, { id: 'a b' })).toBe('/todos/a%20b');
		expect(apiPath(routes.todos.remove.path, { id: '42' })).toBe('/api/todos/42');
	});

	it('derives path parameter types from route templates', () => {
		expectTypeOf<RouteParams<typeof routes.todos.update.path>>().toEqualTypeOf<{ id: string }>();
		expectTypeOf<RouteParams<typeof routes.todos.list.path>>().toEqualTypeOf<Record<never, never>>();
	});

	it('derives request and response payload types from route contracts', () => {
		expectTypeOf<RouteBody<typeof routes.todos.create>>().toEqualTypeOf<CreateTodoBody>();
		expectTypeOf<RouteResponse<typeof routes.todos.create>>().toEqualTypeOf<Todo>();
		expectTypeOf<RouteResponse<typeof routes.todos.list>>().toEqualTypeOf<Todo[]>();
	});
});
