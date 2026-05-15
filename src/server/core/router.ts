import { catchError, mergeMap, of } from 'rxjs';
import type { AppContext, Effect, HttpRequest, Middleware } from './types';
import { errorResponse, NotFound } from './errors';

export interface Route {
	method: string;
	path: string;
	effect: Effect;
	middlewares?: Middleware[];
}

export interface RouteGroup {
	prefix: string;
	routes: RouteDefinition[];
	middlewares?: Middleware[];
}

export type RouteDefinition = Route | RouteGroup;

const joinPath = (prefix: string, path: string): string =>
	`${prefix.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/^$/, '/');

const matchRoute = (pattern: string, url: string): Record<string, string> | null => {
	const patternParts = pattern.split('/').filter(Boolean);
	const urlParts = url.split('/').filter(Boolean);
	if (patternParts.length !== urlParts.length) return null;

	const params: Record<string, string> = {};
	for (let i = 0; i < patternParts.length; i++) {
		if (patternParts[i].startsWith(':')) {
			params[patternParts[i].slice(1)] = decodeURIComponent(urlParts[i]);
		} else if (patternParts[i] !== urlParts[i]) {
			return null;
		}
	}
	return params;
};

export const route = (method: string, path: string, effect: Effect, ...middlewares: Middleware[]): Route => ({
	method,
	path,
	effect,
	middlewares,
});

export const get = (path: string, effect: Effect, ...middlewares: Middleware[]): Route =>
	route('GET', path, effect, ...middlewares);
export const post = (path: string, effect: Effect, ...middlewares: Middleware[]): Route =>
	route('POST', path, effect, ...middlewares);
export const put = (path: string, effect: Effect, ...middlewares: Middleware[]): Route =>
	route('PUT', path, effect, ...middlewares);
export const del = (path: string, effect: Effect, ...middlewares: Middleware[]): Route =>
	route('DELETE', path, effect, ...middlewares);

export const group = (prefix: string, routes: RouteDefinition[], ...middlewares: Middleware[]): RouteGroup => ({
	prefix,
	routes,
	middlewares,
});

export const flattenRoutes = (definitions: RouteDefinition[], parentPrefix = '', parentMiddlewares: Middleware[] = []): Route[] =>
	definitions.flatMap(definition => {
		if (!('prefix' in definition)) {
			return [{
				...definition,
				path: joinPath(parentPrefix, definition.path),
				middlewares: [...parentMiddlewares, ...(definition.middlewares ?? [])],
			}];
		}
		return flattenRoutes(
			definition.routes,
			joinPath(parentPrefix, definition.prefix),
			[...parentMiddlewares, ...(definition.middlewares ?? [])],
		);
	});

export const createRouter = (
	definitions: RouteDefinition[],
	context: AppContext = { services: {}, state: {} },
): Effect =>
	req$ => req$.pipe(
		mergeMap(req => {
			for (const routeDefinition of flattenRoutes(definitions)) {
				if (routeDefinition.method !== req.method) continue;
				const params = matchRoute(routeDefinition.path, req.url);
				if (params === null) continue;

				const enriched: HttpRequest = { ...req, params, context };
				const piped = (routeDefinition.middlewares ?? []).reduce(
					(src$, middleware) => src$.pipe(middleware),
					of(enriched),
				);
				return routeDefinition.effect(piped).pipe(
					catchError(err => of(errorResponse(err))),
				);
			}
			return of(errorResponse(new NotFound()));
		}),
	);
