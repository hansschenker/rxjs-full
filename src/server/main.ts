import { bootstrap } from './core/bootstrap';
import { createRouter } from './core/router';
import { logger } from './core/middleware';
import { getAll$, create$, update$, delete$ } from './todos/todo.effect';

const router = createRouter([
	{ method: 'GET',    path: '/todos',     effect: getAll$ },
	{ method: 'POST',   path: '/todos',     effect: create$ },
	{ method: 'PUT',    path: '/todos/:id', effect: update$ },
	{ method: 'DELETE', path: '/todos/:id', effect: delete$ },
]);

bootstrap(3000, router, logger());
