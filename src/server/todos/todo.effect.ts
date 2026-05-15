import { map } from 'rxjs/operators';
import { NotFound } from '../core/errors';
import { created, json, noContent } from '../core/response';
import type { Effect } from '../core/types';
import { validateBody, validateParams } from '../core/validator';
import { CreateTodoSchema, TodoParamsSchema, UpdateTodoSchema } from './todo.validator';
import type { TodoStore } from './todo.store';
import { routes, type RouteResponse } from '../../shared/routes';
import type { Todo } from '../../shared/types';

export interface TodoServices {
	todoStore: TodoStore;
}

export const createTodoEffects = () => ({
	getAll$: ((req$) =>
		req$.pipe(
			map(req => json(getTodoStore(req).getTodos())),
		)) as Effect,

	create$: ((req$) =>
		req$.pipe(
			validateBody(CreateTodoSchema),
			map(req => {
				const todo: Todo = {
					id: crypto.randomUUID(),
					title: req.body.title,
					completed: false,
					createdAt: new Date().toISOString(),
				};
				const store = getTodoStore(req);
				store.setTodos([...store.getTodos(), todo]);
				return created(todo satisfies RouteResponse<typeof routes.todos.create>);
			}),
		)) as Effect,

	update$: ((req$) =>
		req$.pipe(
			validateParams(TodoParamsSchema),
			validateBody(UpdateTodoSchema),
			map(req => {
				const store = getTodoStore(req);
				const current = store.getTodos();
				if (!current.some(todo => todo.id === req.params.id)) throw new NotFound('Todo not found');
				const updated = current.map(todo =>
					todo.id === req.params.id ? { ...todo, ...req.body } : todo,
				);
				store.setTodos(updated);
				const todo = updated.find(item => item.id === req.params.id);
				if (!todo) throw new NotFound('Todo not found');
				return json(todo satisfies RouteResponse<typeof routes.todos.update>);
			}),
		)) as Effect,

	delete$: ((req$) =>
		req$.pipe(
			validateParams(TodoParamsSchema),
			map(req => {
				const store = getTodoStore(req);
				const current = store.getTodos();
				if (!current.some(todo => todo.id === req.params.id)) throw new NotFound('Todo not found');
				store.setTodos(current.filter(todo => todo.id !== req.params.id));
				return noContent();
			}),
		)) as Effect,
});

const defaultEffects = createTodoEffects();
export const getAll$ = defaultEffects.getAll$;
export const create$ = defaultEffects.create$;
export const update$ = defaultEffects.update$;
export const delete$ = defaultEffects.delete$;

const getTodoStore = (req: { context: { services: Record<string, unknown> } }): TodoStore =>
	req.context.services.todoStore as TodoStore;
