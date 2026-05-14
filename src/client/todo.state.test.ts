import { describe, it, expect } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { skip } from 'rxjs/operators';
import { reducer, state$, dispatch } from './todo.state';
import type { State } from './todo.state';
import type { Todo } from '../shared/types';

const t1: Todo = { id: '1', title: 'First',  completed: false, createdAt: '2026-01-01T00:00:00.000Z' };
const t2: Todo = { id: '2', title: 'Second', completed: true,  createdAt: '2026-01-02T00:00:00.000Z' };

const base: State = { todos: [t1, t2], error: 'prior error' };

describe('reducer — LOAD_SUCCESS', () => {
	it('replaces todos and clears error', () => {
		const s = reducer(base, { type: 'LOAD_SUCCESS', todos: [t1] });
		expect(s.todos).toEqual([t1]);
		expect(s.error).toBeNull();
	});
});

describe('reducer — CREATE_SUCCESS', () => {
	it('appends the new todo without removing existing ones', () => {
		const s = reducer({ todos: [t1], error: null }, { type: 'CREATE_SUCCESS', todo: t2 });
		expect(s.todos).toEqual([t1, t2]);
	});
});

describe('reducer — UPDATE_SUCCESS', () => {
	it('replaces the matching todo by id', () => {
		const updated = { ...t1, completed: true };
		const s = reducer(base, { type: 'UPDATE_SUCCESS', todo: updated });
		expect(s.todos[0].completed).toBe(true);
		expect(s.todos[1]).toBe(t2);
	});

	it('leaves non-matching todos unchanged', () => {
		const updated = { ...t1, title: 'Changed' };
		const s = reducer(base, { type: 'UPDATE_SUCCESS', todo: updated });
		expect(s.todos[1]).toBe(t2);
	});
});

describe('reducer — DELETE_SUCCESS', () => {
	it('removes the todo with the matching id', () => {
		const s = reducer(base, { type: 'DELETE_SUCCESS', id: '1' });
		expect(s.todos).toEqual([t2]);
	});

	it('leaves other todos intact', () => {
		const s = reducer(base, { type: 'DELETE_SUCCESS', id: '1' });
		expect(s.todos[0]).toEqual(t2);
	});
});

describe('reducer — SET_ERROR', () => {
	it('sets the error message', () => {
		const s = reducer(base, { type: 'SET_ERROR', message: 'boom' });
		expect(s.error).toBe('boom');
	});

	it('preserves the current todos', () => {
		const s = reducer(base, { type: 'SET_ERROR', message: 'oops' });
		expect(s.todos).toBe(base.todos);
	});
});

describe('reducer — immutability', () => {
	it('does not mutate the input state', () => {
		const original: State = { todos: [t1], error: null };
		reducer(original, { type: 'CREATE_SUCCESS', todo: t2 });
		expect(original.todos).toHaveLength(1);
	});
});

describe('state$ / dispatch integration', () => {
	it('state$ emits the current state synchronously on subscribe', async () => {
		const s = await firstValueFrom(state$);
		expect(s).toHaveProperty('todos');
		expect(s).toHaveProperty('error');
	});

	it('dispatch → state$ reflects the dispatched action', async () => {
		const next = firstValueFrom(state$.pipe(skip(1)));
		dispatch({ type: 'SET_ERROR', message: 'integration-test-error' });
		const s = await next;
		expect(s.error).toBe('integration-test-error');
	});
});
