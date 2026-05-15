import { from, type Observable } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { switchMap } from 'rxjs/operators';
import {
	apiPath,
	type AnyRoute,
	type RouteBody,
	type RouteParams,
	type RouteQuery,
	type RouteResponse,
} from '../shared/routes';

type HasParams<TRoute extends AnyRoute> =
	keyof RouteParams<TRoute['path']> extends never ? false : true;
type HasQuery<TRoute extends AnyRoute> =
	RouteQuery<TRoute> extends undefined ? false : true;

export type ClientMethod<TRoute extends AnyRoute> =
	RouteBody<TRoute> extends undefined
		? HasParams<TRoute> extends true
			? HasQuery<TRoute> extends true
				? (params: RouteParams<TRoute['path']>, query: RouteQuery<TRoute>) => Observable<RouteResponse<TRoute>>
				: (params: RouteParams<TRoute['path']>) => Observable<RouteResponse<TRoute>>
			: HasQuery<TRoute> extends true
				? (query: RouteQuery<TRoute>) => Observable<RouteResponse<TRoute>>
				: () => Observable<RouteResponse<TRoute>>
		: HasParams<TRoute> extends true
			? HasQuery<TRoute> extends true
				? (params: RouteParams<TRoute['path']>, query: RouteQuery<TRoute>, body: RouteBody<TRoute>) => Observable<RouteResponse<TRoute>>
				: (params: RouteParams<TRoute['path']>, body: RouteBody<TRoute>) => Observable<RouteResponse<TRoute>>
			: HasQuery<TRoute> extends true
				? (query: RouteQuery<TRoute>, body: RouteBody<TRoute>) => Observable<RouteResponse<TRoute>>
				: (body: RouteBody<TRoute>) => Observable<RouteResponse<TRoute>>;

export type ClientFor<TContract> =
	TContract extends AnyRoute
		? ClientMethod<TContract>
		: { [Key in keyof TContract]: ClientFor<TContract[Key]> };

export const request$ = <TRoute extends AnyRoute>(
	route: TRoute,
	params: RouteParams<TRoute['path']>,
	query: RouteQuery<TRoute>,
	...bodyArg: RouteBody<TRoute> extends undefined ? [] : [RouteBody<TRoute>]
): Observable<RouteResponse<TRoute>> =>
	requestCore$(route, params as Record<string, string>, query as Record<string, string | undefined> | undefined, bodyArg[0]) as Observable<RouteResponse<TRoute>>;

const requestCore$ = (
	route: AnyRoute,
	params: Record<string, string>,
	query?: Record<string, string | undefined>,
	body?: unknown,
): Observable<unknown> => {
	const init: RequestInit = route.method === 'GET' || route.method === 'DELETE'
		? { method: route.method }
		: {
			method: route.method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		};

	return fromFetch(apiPath(route.path, params, query), init).pipe(
		switchMap(res =>
			route.method === 'DELETE'
				? from(Promise.resolve(undefined))
				: from(res.json() as Promise<unknown>),
		),
	);
};

export const createClient = <TContract>(contract: TContract): ClientFor<TContract> => {
	const build = (node: unknown): unknown => {
		if (isRoute(node)) {
			return (...args: unknown[]) => {
				const hasParams = /:[A-Za-z0-9_]+/.test(node.path);
				const hasQuery = node.query !== undefined;
				const params = hasParams ? args[0] as Record<string, string> : {};
				const query = hasQuery ? args[hasParams ? 1 : 0] as Record<string, string | undefined> : undefined;
				const body = args[hasParams ? (hasQuery ? 2 : 1) : (hasQuery ? 1 : 0)];
				return requestCore$(node, params, query, body);
			};
		}

		return Object.fromEntries(
			Object.entries(node as Record<string, unknown>).map(([key, value]) => [key, build(value)]),
		);
	};

	return build(contract) as ClientFor<TContract>;
};

const isRoute = (value: unknown): value is AnyRoute =>
	typeof value === 'object'
	&& value !== null
	&& 'method' in value
	&& 'path' in value;
