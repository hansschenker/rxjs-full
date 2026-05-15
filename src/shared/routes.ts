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
	TQuery = undefined,
	TResponse = unknown,
> {
	method: TMethod;
	path: TPath;
	body: TBody;
	query: TQuery;
	response: TResponse;
}

export type AnyRoute = RouteContract<HttpMethod, string, unknown, unknown, unknown>;
export type RouteBody<TRoute extends AnyRoute> = TRoute['body'];
export type RouteQuery<TRoute extends AnyRoute> = TRoute['query'];
export type RouteResponse<TRoute extends AnyRoute> = TRoute['response'];
export type RoutePath<TRoute extends AnyRoute> = TRoute['path'];
export type RouteRequest<TRoute extends AnyRoute> = {
	params: RouteParams<RoutePath<TRoute>>;
	body: RouteBody<TRoute>;
	query: RouteQuery<TRoute>;
};

const defineRoute = <
	TMethod extends HttpMethod,
	TPath extends string,
	TBody = undefined,
	TQuery = undefined,
	TResponse = unknown,
>(
	method: TMethod,
	path: TPath,
	hasQuery?: boolean,
): RouteContract<TMethod, TPath, TBody, TQuery, TResponse> => ({
	method,
	path,
	body: undefined as TBody,
	query: (hasQuery === true ? {} : undefined) as TQuery,
	response: undefined as TResponse,
});

export const routes = {
	todos: {
		list: defineRoute<'GET', '/todos', undefined, { completed?: 'true' | 'false' }, Todo[]>('GET', '/todos', true),
		create: defineRoute<'POST', '/todos', CreateTodoBody, undefined, Todo>('POST', '/todos'),
		update: defineRoute<'PUT', '/todos/:id', UpdateTodoBody, undefined, Todo>('PUT', '/todos/:id'),
		remove: defineRoute<'DELETE', '/todos/:id', undefined, undefined, void>('DELETE', '/todos/:id'),
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
	query?: Record<string, string | undefined>,
): string => {
	const concrete = `/api${buildPath(path, params)}`;
	const entries = Object.entries(query ?? {}).filter(([, value]) => value !== undefined);
	return entries.length === 0 ? concrete : `${concrete}?${new URLSearchParams(entries as Array<[string, string]>).toString()}`;
};
