import type * as http from 'http';
import type { Observable, OperatorFunction } from 'rxjs';

export interface HttpRequest {
	method: string;
	url: string;
	params: Record<string, string>;
	query: Record<string, string>;
	body: unknown;
	headers: Record<string, string>;
	raw: http.IncomingMessage;
}

export interface HttpResponse {
	status?: number;
	body?: unknown;
	headers?: Record<string, string>;
}

// Idea 1: Effect — pure function from Observable<HttpRequest> to Observable<HttpResponse>
export type Effect = (req$: Observable<HttpRequest>) => Observable<HttpResponse>;

// Idea 2: Middleware — OperatorFunction that transforms the request stream
export type Middleware = OperatorFunction<HttpRequest, HttpRequest>;
