import { from, type Observable } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';
import { switchMap } from 'rxjs/operators';
import {
	apiPath,
	type AnyRoute,
	type RouteBody,
	type RouteParams,
	type RouteResponse,
} from '../shared/routes';

type HasParams<TRoute extends AnyRoute> =
	keyof RouteParams<TRoute['path']> extends never ? false : true;

export type ClientMethod<TRoute extends AnyRoute> =
	RouteBody<TRoute> extends undefined
		? HasParams<TRoute> extends true
			? (params: RouteParams<TRoute['path']>) => Observable<RouteResponse<TRoute>>
			: () => Observable<RouteResponse<TRoute>>
		: HasParams<TRoute> extends true
			? (params: RouteParams<TRoute['path']>, body: RouteBody<TRoute>) => Observable<RouteResponse<TRoute>>
			: (body: RouteBody<TRoute>) => Observable<RouteResponse<TRoute>>;

export type ClientFor<TContract> =
	TContract extends AnyRoute
		? ClientMethod<TContract>
		: { [Key in keyof TContract]: ClientFor<TContract[Key]> };

export const request$ = <TRoute extends AnyRoute>(
	route: TRoute,
	params: RouteParams<TRoute['path']>,
	...bodyArg: RouteBody<TRoute> extends undefined ? [] : [RouteBody<TRoute>]
): Observable<RouteResponse<TRoute>> =>
	requestCore$(route, params as Record<string, string>, bodyArg[0]) as Observable<RouteResponse<TRoute>>;

const requestCore$ = (
	route: AnyRoute,
	params: Record<string, string>,
	body?: unknown,
): Observable<unknown> => {
	const init: RequestInit = route.method === 'GET' || route.method === 'DELETE'
		? { method: route.method }
		: {
			method: route.method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		};

	return fromFetch(apiPath(route.path, params), init).pipe(
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
				const params = hasParams ? args[0] as Record<string, string> : {};
				const body = hasParams ? args[1] : args[0];
				return requestCore$(node, params, body);
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
