import { BehaviorSubject } from 'rxjs';
import type { Todo } from '../../shared/types';

const seed: Todo[] = [
	{ id: '1', title: 'Learn rxjs-full', completed: false, createdAt: new Date().toISOString() },
];

const store$ = new BehaviorSubject<Todo[]>([...seed]);

export const getTodos = (): Todo[] => [...store$.getValue()];
export const setTodos = (todos: Todo[]): void => store$.next(todos);
export const resetStore = (): void => store$.next([...seed]);
