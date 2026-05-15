import { createApp } from './core/app';
import { logger } from './core/middleware';
import { del, get, group, post, put } from './core/router';
import { createTodoEffects } from './todos/todo.effect';
import { createTodoStore } from './todos/todo.store';
import { routes } from '../shared/routes';

const todoEffects = createTodoEffects();

const app = createApp([
	group('', [
		get(routes.todos.list.path, todoEffects.getAll$),
		post(routes.todos.create.path, todoEffects.create$),
		put(routes.todos.update.path, todoEffects.update$),
		del(routes.todos.remove.path, todoEffects.delete$),
	]),
], {
	services: {
		todoStore: createTodoStore(),
	},
	middlewares: [logger()],
});

void app.start(3000);
