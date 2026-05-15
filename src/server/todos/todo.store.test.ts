import { firstValueFrom, skip, take, toArray } from 'rxjs';
import { createTodoStore } from './todo.store';
import type { Todo } from '../../shared/types';

const makeTodo = (id: string): Todo => ({
	id,
	title: `Todo ${id}`,
	completed: false,
	createdAt: '2026-01-01T00:00:00.000Z',
});

describe('TodoStore.todos$', () => {
	it('emits the current store contents on subscribe', async () => {
		const store = createTodoStore();
		const todos = await firstValueFrom(store.todos$);
		expect(Array.isArray(todos)).toBe(true);
		expect(todos.length).toBeGreaterThan(0);
	});

	it('emits the new value when setTodos is called', async () => {
		const store = createTodoStore();
		const newTodos = [makeTodo('99')];
		const emissionPromise = firstValueFrom(store.todos$.pipe(skip(1)));
		store.setTodos(newTodos);
		const received = await emissionPromise;
		expect(received).toEqual(newTodos);
	});

	it('emits each setTodos call in subscription order', async () => {
		const store = createTodoStore();
		const emissionsPromise = firstValueFrom(
			store.todos$.pipe(skip(1), take(2), toArray()),
		);
		store.setTodos([makeTodo('a')]);
		store.setTodos([makeTodo('b')]);
		const received = await emissionsPromise;
		expect(received[0]).toEqual([makeTodo('a')]);
		expect(received[1]).toEqual([makeTodo('b')]);
	});
});
