import { BehaviorSubject } from 'rxjs';
import type { Observable } from 'rxjs';
import type { Todo } from '../../shared/types';

export interface TodoStore {
	getTodos: () => Todo[];
	setTodos: (todos: Todo[]) => void;
	reset: () => void;
	todos$: Observable<Todo[]>;
}

const createSeed = (): Todo[] => [
	{ id: '1', title: 'Learn rxjs-stack', completed: false, createdAt: new Date().toISOString() },
];

export const createTodoStore = (): TodoStore => {
	const seed = createSeed();
	const store$ = new BehaviorSubject<Todo[]>([...seed]);

	return {
		getTodos: () => [...store$.getValue()],
		setTodos: todos => store$.next(todos),
		reset: () => store$.next([...seed]),
		todos$: store$.asObservable(),
	};
};

const defaultStore = createTodoStore();
export const todoStore = defaultStore;
export const getTodos = defaultStore.getTodos;
export const setTodos = defaultStore.setTodos;
export const resetStore = defaultStore.reset;
