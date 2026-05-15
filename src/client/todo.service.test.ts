import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, firstValueFrom } from 'rxjs';

vi.mock('rxjs/fetch', () => ({
	fromFetch: vi.fn(),
}));

import { fromFetch } from 'rxjs/fetch';
import { getAll$, create$, update$, remove$ } from './todo.service';
import type { Todo } from '../shared/types';

const mockFromFetch = vi.mocked(fromFetch);

const fakeRes = (data: unknown): Response =>
	({ json: () => Promise.resolve(data) }) as unknown as Response;

const todo: Todo = { id: '1', title: 'Test todo', completed: false, createdAt: '2026-01-01T00:00:00.000Z' };

beforeEach(() => { vi.clearAllMocks(); });

describe('getAll$()', () => {
	it('calls fromFetch with the base URL and returns parsed todos', async () => {
		mockFromFetch.mockReturnValue(of(fakeRes([todo])));
		const result = await firstValueFrom(getAll$());
		expect(mockFromFetch).toHaveBeenCalledWith('/api/todos', expect.objectContaining({
			method: 'GET',
		}));
		expect(result).toEqual([todo]);
	});
});

describe('create$()', () => {
	it('POSTs to /api/todos with JSON body and returns the new todo', async () => {
		mockFromFetch.mockReturnValue(of(fakeRes(todo)));
		const result = await firstValueFrom(create$({ title: 'Test todo' }));
		expect(mockFromFetch).toHaveBeenCalledWith('/api/todos', expect.objectContaining({
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: 'Test todo' }),
		}));
		expect(result).toEqual(todo);
	});
});

describe('update$()', () => {
	it('PUTs to /api/todos/:id with JSON body and returns updated todo', async () => {
		const updated = { ...todo, completed: true };
		mockFromFetch.mockReturnValue(of(fakeRes(updated)));
		const result = await firstValueFrom(update$('1', { completed: true }));
		expect(mockFromFetch).toHaveBeenCalledWith('/api/todos/1', expect.objectContaining({
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ completed: true }),
		}));
		expect(result).toEqual(updated);
	});

	it('sends only the fields included in UpdateTodoBody', async () => {
		mockFromFetch.mockReturnValue(of(fakeRes({ ...todo, title: 'Renamed' })));
		await firstValueFrom(update$('1', { title: 'Renamed' }));
		expect(mockFromFetch).toHaveBeenCalledWith('/api/todos/1', expect.objectContaining({
			body: JSON.stringify({ title: 'Renamed' }),
		}));
	});
});

describe('remove$()', () => {
	it('DELETEs /api/todos/:id and resolves to undefined', async () => {
		mockFromFetch.mockReturnValue(of(fakeRes(null)));
		const result = await firstValueFrom(remove$('1'));
		expect(mockFromFetch).toHaveBeenCalledWith('/api/todos/1', expect.objectContaining({
			method: 'DELETE',
		}));
		expect(result).toBeUndefined();
	});
});
