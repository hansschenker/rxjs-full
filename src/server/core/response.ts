import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import type { HttpResponse, SseEvent } from './types';

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): HttpResponse => ({
	status,
	body,
	headers,
});

export const created = (body: unknown, headers: Record<string, string> = {}): HttpResponse =>
	json(body, 201, headers);

export const noContent = (headers: Record<string, string> = {}): HttpResponse => ({
	status: 204,
	headers,
});

export const redirect = (location: string, status = 302): HttpResponse => ({
	status,
	headers: { Location: location },
});

export const withHeader = (response: HttpResponse, name: string, value: string): HttpResponse => ({
	...response,
	headers: { ...response.headers, [name]: value },
});

export const withCookie = (
	response: HttpResponse,
	name: string,
	value: string,
	options: Record<string, string | number | boolean> = {},
): HttpResponse => {
	const attributes = Object.entries(options).map(([key, optionValue]) =>
		optionValue === true ? key : `${key}=${String(optionValue)}`,
	);
	return withHeader(response, 'Set-Cookie', [`${name}=${value}`, ...attributes].join('; '));
};

export const stream$ = <T>(source$: Observable<T>, eventType?: string): HttpResponse => ({
	status: 200,
	headers: {
		'Content-Type': 'text/event-stream',
		'Cache-Control': 'no-cache',
		'Connection': 'keep-alive',
	},
	stream: source$.pipe(
		map((data): SseEvent => ({ event: eventType, data })),
	),
});
