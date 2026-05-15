import { createApp } from './core/app';
import { logger, requestId } from './core/middleware';
import { group, handle } from './core/router';
import { createTodoEffects } from './todos/todo.effect';
import { createTodoStore } from './todos/todo.store';
import { routes } from '../shared/routes';

const todoEffects = createTodoEffects();

const app = createApp([
	group('', [
		handle(routes.todos.list, todoEffects.getAll$),
		handle(routes.todos.create, todoEffects.create$),
		handle(routes.todos.update, todoEffects.update$),
		handle(routes.todos.remove, todoEffects.delete$),
		handle(routes.todos.stream, todoEffects.todoStream$),
	]),
], {
	services: {
		todoStore: createTodoStore(),
	},
	middlewares: [requestId(), logger()],
});

void app.start(3000);
