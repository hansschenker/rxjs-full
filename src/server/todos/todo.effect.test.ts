import { firstValueFrom, of, skip } from 'rxjs';
import type { HttpRequest } from '../core/types';
import { ValidationError } from '../core/validator';
import { createTodoStore, resetStore, setTodos, getTodos, todoStore } from './todo.store';
import { getAll$, create$, update$, delete$, todoStream$ } from './todo.effect';
import type * as http from 'http';

const mockReq = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
	method: 'GET',
	url: '/',
	params: {},
	query: {},
	body: {},
	headers: {},
	raw: {} as http.IncomingMessage,
	context: { services: { todoStore }, state: {} },
	requestContext: { state: {} },
	...overrides,
});

describe('getAll$', () => {
	beforeEach(() => resetStore());

	it('returns all todos as body', async () => {
		const res = await firstValueFrom(getAll$(of(mockReq())));
		expect(Array.isArray(res.body)).toBe(true);
		expect((res.body as unknown[]).length).toBeGreaterThan(0);
	});

	it('returns 200', async () => {
		const res = await firstValueFrom(getAll$(of(mockReq())));
		expect(res.status).toBe(200);
	});

	it('reflects store changes', async () => {
		setTodos([
			{ id: '1', title: 'First',  completed: false, createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: '2', title: 'Second', completed: true,  createdAt: '2026-01-02T00:00:00.000Z' },
		]);
		const res = await firstValueFrom(getAll$(of(mockReq())));
		expect((res.body as unknown[]).length).toBe(2);
	});
});

describe('create$', () => {
	beforeEach(() => resetStore());

	it('returns 201 with the new todo', async () => {
		const res = await firstValueFrom(create$(of(mockReq({ body: { title: 'New todo' } }))));
		expect(res.status).toBe(201);
		expect((res.body as { title: string }).title).toBe('New todo');
	});

	it('sets completed to false and generates an id', async () => {
		const res = await firstValueFrom(create$(of(mockReq({ body: { title: 'Test' } }))));
		const todo = res.body as { id: string; completed: boolean };
		expect(todo.completed).toBe(false);
		expect(todo.id).toBeDefined();
		expect(typeof todo.id).toBe('string');
	});

	it('persists the new todo to the store', async () => {
		await firstValueFrom(create$(of(mockReq({ body: { title: 'Persisted' } }))));
		expect(getTodos().some(t => t.title === 'Persisted')).toBe(true);
	});

	it('appends to existing todos rather than replacing them', async () => {
		const before = getTodos().length;
		await firstValueFrom(create$(of(mockReq({ body: { title: 'Added' } }))));
		expect(getTodos().length).toBe(before + 1);
	});

	it('throws ValidationError when title is missing', async () => {
		await expect(
			firstValueFrom(create$(of(mockReq({ body: {} }))))
		).rejects.toBeInstanceOf(ValidationError);
	});

	it('throws ValidationError when title is not a string', async () => {
		await expect(
			firstValueFrom(create$(of(mockReq({ body: { title: 42 } }))))
		).rejects.toBeInstanceOf(ValidationError);
	});
});

describe('update$', () => {
	beforeEach(() => {
		resetStore();
		setTodos([{ id: '1', title: 'Original', completed: false, createdAt: '2026-01-01T00:00:00.000Z' }]);
	});

	it('returns the updated todo', async () => {
		const res = await firstValueFrom(
			update$(of(mockReq({ params: { id: '1' }, body: { completed: true } })))
		);
		expect((res.body as { completed: boolean }).completed).toBe(true);
		expect((res.body as { title: string }).title).toBe('Original');
	});

	it('persists the update to the store', async () => {
		await firstValueFrom(
			update$(of(mockReq({ params: { id: '1' }, body: { title: 'Updated' } })))
		);
		expect(getTodos()[0].title).toBe('Updated');
	});

	it('updates only the specified todo', async () => {
		setTodos([
			{ id: '1', title: 'First',  completed: false, createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: '2', title: 'Second', completed: false, createdAt: '2026-01-02T00:00:00.000Z' },
		]);
		await firstValueFrom(
			update$(of(mockReq({ params: { id: '1' }, body: { completed: true } })))
		);
		expect(getTodos()[0].completed).toBe(true);
		expect(getTodos()[1].completed).toBe(false);
	});

	it('throws ValidationError when body contains wrong types', async () => {
		await expect(
			firstValueFrom(update$(of(mockReq({ params: { id: '1' }, body: { completed: 'yes' } }))))
		).rejects.toBeInstanceOf(ValidationError);
	});

	it('throws NotFound when the todo does not exist', async () => {
		await expect(firstValueFrom(
			update$(of(mockReq({ params: { id: 'missing' }, body: { completed: true } })))
		)).rejects.toMatchObject({ status: 404, message: 'Todo not found' });
	});
});

describe('delete$', () => {
	beforeEach(() => {
		resetStore();
		setTodos([{ id: '1', title: 'To delete', completed: false, createdAt: '2026-01-01T00:00:00.000Z' }]);
	});

	it('returns 204', async () => {
		const res = await firstValueFrom(delete$(of(mockReq({ params: { id: '1' } }))));
		expect(res.status).toBe(204);
	});

	it('removes the todo from the store', async () => {
		await firstValueFrom(delete$(of(mockReq({ params: { id: '1' } }))));
		expect(getTodos()).toHaveLength(0);
	});

	it('removes only the matching todo', async () => {
		setTodos([
			{ id: '1', title: 'Keep',   completed: false, createdAt: '2026-01-01T00:00:00.000Z' },
			{ id: '2', title: 'Delete', completed: false, createdAt: '2026-01-02T00:00:00.000Z' },
		]);
		await firstValueFrom(delete$(of(mockReq({ params: { id: '2' } }))));
		expect(getTodos()).toHaveLength(1);
		expect(getTodos()[0].id).toBe('1');
	});

	it('throws NotFound when deleting a non-existent id', async () => {
		const before = getTodos().length;
		await expect(firstValueFrom(delete$(of(mockReq({ params: { id: 'nonexistent' } })))))
			.rejects.toMatchObject({ status: 404, message: 'Todo not found' });
		expect(getTodos().length).toBe(before);
	});
});

describe('todoStream$', () => {
	it('returns an HttpResponse with stream set and SSE Content-Type header', async () => {
		const store = createTodoStore();
		const res = await firstValueFrom(
			todoStream$(of(mockReq({ context: { services: { todoStore: store }, state: {} } }))),
		);
		expect(res.stream).toBeDefined();
		expect(res.headers?.['Content-Type']).toBe('text/event-stream');
	});

	it('stream emits a todos event for each store update', async () => {
		const store = createTodoStore();
		const res = await firstValueFrom(
			todoStream$(of(mockReq({ context: { services: { todoStore: store }, state: {} } }))),
		);
		const eventPromise = firstValueFrom(res.stream!.pipe(skip(1)));
		store.setTodos([{ id: '99', title: 'New', completed: false, createdAt: '2026-01-01T00:00:00.000Z' }]);
		const event = await eventPromise;
		expect(event.event).toBe('todos');
		expect(Array.isArray(event.data)).toBe(true);
	});
});
