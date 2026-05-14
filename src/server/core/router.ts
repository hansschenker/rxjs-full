// Idea 5: Routing as filter — the router is itself an Effect
// Routes are matched by method + path pattern; params are extracted and merged into the request.

import { of, mergeMap, catchError } from 'rxjs';
import type { Effect, HttpRequest, HttpResponse } from './types';
import { ValidationError } from './validator';

export interface Route {
	method: string;
	path: string;
	effect: Effect;
}

// Naive param extraction: /todos/:id matched against /todos/42 → { id: '42' }
const matchRoute = (pattern: string, url: string): Record<string, string> | null => {
	const patternParts = pattern.split('/');
	const urlParts = url.split('/');
	if (patternParts.length !== urlParts.length) return null;

	const params: Record<string, string> = {};
	for (let i = 0; i < patternParts.length; i++) {
		if (patternParts[i].startsWith(':')) {
			params[patternParts[i].slice(1)] = urlParts[i];
		} else if (patternParts[i] !== urlParts[i]) {
			return null;
		}
	}
	return params;
};

const NOT_FOUND: HttpResponse  = { status: 404, body: { error: 'Not found' } };
const SERVER_ERROR: HttpResponse = { status: 500, body: { error: 'Internal server error' } };
const UNPROCESSABLE: HttpResponse = { status: 422, body: { error: 'Validation failed' } };

// The router is itself an Effect: (req$) => Observable<HttpResponse>
export const createRouter = (routes: Route[]): Effect =>
	req$ => req$.pipe(
		mergeMap(req => {
			for (const route of routes) {
				if (route.method !== req.method) continue;
				const params = matchRoute(route.path, req.url);
				if (params === null) continue;

				const enriched: HttpRequest = { ...req, params };
				return route.effect(of(enriched)).pipe(
					catchError(err => {
						if (err instanceof ValidationError) return of(UNPROCESSABLE);
						console.error(err);
						return of(SERVER_ERROR);
					}),
				);
			}
			return of(NOT_FOUND);
		}),
	);
