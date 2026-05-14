// Todo Effects using the rxjs-full core primitives.
// Key improvement over the Marble.js prototype: validate() narrows req.body correctly —
// no type casts needed after validation.

import { map } from 'rxjs/operators';
import type { Effect } from '../core/types';
import { validate } from '../core/validator';
import { CreateTodoCodec, UpdateTodoCodec } from './todo.validator';
import { getTodos, setTodos } from './todo.store';
import type { Todo } from '../../shared/types';

export const getAll$: Effect = req$ =>
	req$.pipe(
		map(() => ({ body: getTodos() })),
	);

export const create$: Effect = req$ =>
	req$.pipe(
		validate(CreateTodoCodec),
		map(req => {
			const todo: Todo = {
				id:          crypto.randomUUID(),
				title:       req.body.title,   // typed as string — no cast
				completed:   false,
				createdAt:   new Date().toISOString(),
			};
			setTodos([...getTodos(), todo]);
			return { status: 201, body: todo };
		}),
	);

export const update$: Effect = req$ =>
	req$.pipe(
		validate(UpdateTodoCodec),
		map(req => {
			const { id } = req.params;
			const updated = getTodos().map(t =>
				t.id === id ? { ...t, ...req.body } : t,  // req.body typed as UpdateTodoInput
			);
			setTodos(updated);
			return { body: updated.find(t => t.id === id) };
		}),
	);

export const delete$: Effect = req$ =>
	req$.pipe(
		map(req => {
			setTodos(getTodos().filter(t => t.id !== req.params.id));
			return { status: 204 };
		}),
	);
