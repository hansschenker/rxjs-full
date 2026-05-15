import type * as http from 'http';
import type { Observable, OperatorFunction } from 'rxjs';

export interface AppContext<TServices extends object = Record<string, unknown>> {
	services: TServices;
	state: Record<string, unknown>;
}

export interface HttpRequest<
	TBody = unknown,
	TParams extends Record<string, string> = Record<string, string>,
	TQuery extends Record<string, string> = Record<string, string>,
> {
	method: string;
	url: string;
	params: TParams;
	query: TQuery;
	body: TBody;
	headers: Record<string, string>;
	raw: http.IncomingMessage;
	context: AppContext;
}

export interface HttpResponse {
	status?: number;
	body?: unknown;
	headers?: Record<string, string>;
}

export type Effect<TRequest extends HttpRequest = HttpRequest> = (req$: Observable<TRequest>) => Observable<HttpResponse>;
export type Middleware<TRequest extends HttpRequest = HttpRequest> = OperatorFunction<TRequest, TRequest>;
