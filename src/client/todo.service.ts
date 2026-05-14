import { Observable, from } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { switchMap, map } from 'rxjs/operators';
import type { Todo, CreateTodoBody, UpdateTodoBody } from '../shared/types';

const BASE = '/api/todos';

const json$ = <T>(res: Response): Observable<T> => from(res.json() as Promise<T>);

export const getAll$ = (): Observable<Todo[]> =>
	fromFetch(BASE).pipe(switchMap(res => json$<Todo[]>(res)));

export const create$ = (body: CreateTodoBody): Observable<Todo> =>
	fromFetch(BASE, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}).pipe(switchMap(res => json$<Todo>(res)));

export const update$ = (id: string, body: UpdateTodoBody): Observable<Todo> =>
	fromFetch(`${BASE}/${id}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	}).pipe(switchMap(res => json$<Todo>(res)));

export const remove$ = (id: string): Observable<void> =>
	fromFetch(`${BASE}/${id}`, { method: 'DELETE' }).pipe(map(() => undefined));
