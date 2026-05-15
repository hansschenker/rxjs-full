import { createApp } from './core/app';
import { logger } from './core/middleware';
import { del, get, group, post, put } from './core/router';
import { createTodoEffects } from './todos/todo.effect';
import { createTodoStore } from './todos/todo.store';

const todoEffects = createTodoEffects();

const app = createApp([
	group('/todos', [
		get('/', todoEffects.getAll$),
		post('/', todoEffects.create$),
		put('/:id', todoEffects.update$),
		del('/:id', todoEffects.delete$),
	]),
], {
	services: {
		todoStore: createTodoStore(),
	},
	middlewares: [logger()],
});

void app.start(3000);
