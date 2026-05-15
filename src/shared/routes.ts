import type { CreateTodoBody, Todo, UpdateTodoBody } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type RouteParams<Path extends string> =
	Path extends `${string}:${infer Param}/${infer Rest}`
		? { [Key in Param | keyof RouteParams<`/${Rest}`>]: string }
		: Path extends `${string}:${infer Param}`
			? { [Key in Param]: string }
			: Record<never, never>;

export interface RouteContract<
	TMethod extends HttpMethod,
	TPath extends string,
	TBody = undefined,
	TResponse = unknown,
> {
	method: TMethod;
	path: TPath;
	body: TBody;
	response: TResponse;
}

export type AnyRoute = RouteContract<HttpMethod, string, unknown, unknown>;
export type RouteBody<TRoute extends RouteContract<HttpMethod, string, unknown, unknown>> = TRoute['body'];
export type RouteResponse<TRoute extends RouteContract<HttpMethod, string, unknown, unknown>> = TRoute['response'];
export type RoutePath<TRoute extends RouteContract<HttpMethod, string, unknown, unknown>> = TRoute['path'];
export type RouteRequest<TRoute extends RouteContract<HttpMethod, string, unknown, unknown>> = {
	params: RouteParams<RoutePath<TRoute>>;
	body: RouteBody<TRoute>;
};

const defineRoute = <
	TMethod extends HttpMethod,
	TPath extends string,
	TBody = undefined,
	TResponse = unknown,
>(
	method: TMethod,
	path: TPath,
): RouteContract<TMethod, TPath, TBody, TResponse> => ({
	method,
	path,
	body: undefined as TBody,
	response: undefined as TResponse,
});

export const routes = {
	todos: {
		list: defineRoute<'GET', '/todos', undefined, Todo[]>('GET', '/todos'),
		create: defineRoute<'POST', '/todos', CreateTodoBody, Todo>('POST', '/todos'),
		update: defineRoute<'PUT', '/todos/:id', UpdateTodoBody, Todo>('PUT', '/todos/:id'),
		remove: defineRoute<'DELETE', '/todos/:id', undefined, void>('DELETE', '/todos/:id'),
	},
} as const;

export type Routes = typeof routes;

export const buildPath = <TPath extends string>(
	path: TPath,
	params: RouteParams<TPath>,
): string =>
	path.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) =>
		encodeURIComponent((params as Record<string, string>)[key]),
	);

export const apiPath = <TPath extends string>(
	path: TPath,
	params: RouteParams<TPath>,
): string => `/api${buildPath(path, params)}`;
