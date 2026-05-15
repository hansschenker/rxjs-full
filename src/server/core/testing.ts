import type * as http from 'http';
import { firstValueFrom, of } from 'rxjs';
import { createRouter, type RouteDefinition } from './router';
import type { AppContext, Effect, HttpRequest, HttpResponse } from './types';

export const createTestContext = <TServices extends Record<string, unknown> = Record<string, unknown>>(
	services = {} as TServices,
): AppContext<TServices> => ({
	services,
	state: {},
});

export const createTestRequest = (
	overrides: Partial<HttpRequest> = {},
): HttpRequest => ({
	method: 'GET',
	url: '/',
	params: {},
	query: {},
	body: {},
	headers: {},
	raw: {} as http.IncomingMessage,
	context: createTestContext(),
	...overrides,
});

export const runEffect = async (effect: Effect, request: HttpRequest): Promise<HttpResponse> =>
	firstValueFrom(effect(of(request)));

export const runRequest = async (
	routes: RouteDefinition[],
	request: HttpRequest,
	context = request.context,
): Promise<HttpResponse> =>
	firstValueFrom(createRouter(routes, context)(of(request)));

export interface HttpTestClient {
	get: (path: string) => Promise<Response>;
	post: (path: string, body?: unknown) => Promise<Response>;
	put: (path: string, body?: unknown) => Promise<Response>;
	delete: (path: string) => Promise<Response>;
}

export const createHttpTestClient = (baseUrl: string): HttpTestClient => ({
	get: path => fetch(`${baseUrl}${path}`),
	post: (path, body) => fetch(`${baseUrl}${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	}),
	put: (path, body) => fetch(`${baseUrl}${path}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: body === undefined ? undefined : JSON.stringify(body),
	}),
	delete: path => fetch(`${baseUrl}${path}`, { method: 'DELETE' }),
});
