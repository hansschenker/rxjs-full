import { createClient } from './api';
import { routes } from '../shared/routes';

export const api = createClient(routes);

export const getAll$ = () => api.todos.list({});
export const create$ = api.todos.create;
export const update$ = (id: string, body: Parameters<typeof api.todos.update>[1]) =>
	api.todos.update({ id }, body);
export const remove$ = (id: string) =>
	api.todos.remove({ id });
