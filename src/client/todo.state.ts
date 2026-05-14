import { Subject } from 'rxjs';
import { scan, startWith, shareReplay } from 'rxjs/operators';
import type { Todo } from '../shared/types';

export type Action =
	| { type: 'LOAD_SUCCESS'; todos: Todo[] }
	| { type: 'CREATE_SUCCESS'; todo: Todo }
	| { type: 'UPDATE_SUCCESS'; todo: Todo }
	| { type: 'DELETE_SUCCESS'; id: string }
	| { type: 'SET_ERROR'; message: string };

export interface State {
	todos: Todo[];
	error: string | null;
}

export const initialState: State = { todos: [], error: null };

export const reducer = (state: State, action: Action): State => {
	switch (action.type) {
		case 'LOAD_SUCCESS':   return { ...state, todos: action.todos, error: null };
		case 'CREATE_SUCCESS': return { ...state, todos: [...state.todos, action.todo] };
		case 'UPDATE_SUCCESS': return { ...state, todos: state.todos.map(t => t.id === action.todo.id ? action.todo : t) };
		case 'DELETE_SUCCESS': return { ...state, todos: state.todos.filter(t => t.id !== action.id) };
		case 'SET_ERROR':      return { ...state, error: action.message };
	}
};

export const action$ = new Subject<Action>();
export const state$ = action$.pipe(scan(reducer, initialState), startWith(initialState), shareReplay(1));
export const dispatch = (action: Action): void => action$.next(action);
