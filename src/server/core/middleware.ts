import { map, mergeMap, of, tap } from 'rxjs';
import type { Effect, Middleware } from './types';

export const logger = (): Middleware =>
	tap(req => console.log(`${req.method} ${req.url}`));

export const requestId = (): Middleware =>
	tap(req => {
		req.requestContext.requestId = crypto.randomUUID();
	});

export interface CorsOptions {
	origins?: string[] | '*';
	methods?: string[];
	allowedHeaders?: string[];
	maxAge?: number;
	credentials?: boolean;
}

const resolveOrigin = (requestOrigin: string | undefined, options: CorsOptions): string => {
	const { origins = '*', credentials } = options;
	if (origins === '*') return credentials ? (requestOrigin ?? '') : '*';
	if (!requestOrigin) return '';
	return (origins as string[]).includes(requestOrigin) ? requestOrigin : '';
};

export const cors = (options: CorsOptions = {}): (effect: Effect) => Effect => {
	const {
		methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders = ['Content-Type', 'Authorization'],
		maxAge = 86400,
		credentials,
	} = options;

	return (effect: Effect): Effect =>
		req$ =>
			req$.pipe(
				mergeMap(req => {
					const origin = resolveOrigin(req.headers['origin'], options);
					const baseHeaders: Record<string, string> = {
						...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
						...(credentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
					};

					if (req.method === 'OPTIONS') {
						return of({
							status: 204,
							headers: {
								...baseHeaders,
								'Access-Control-Allow-Methods': methods.join(', '),
								'Access-Control-Allow-Headers': allowedHeaders.join(', '),
								'Access-Control-Max-Age': String(maxAge),
							},
						});
					}

					return effect(of(req)).pipe(
						map(res => ({
							...res,
							headers: { ...baseHeaders, ...(res.headers ?? {}) },
						})),
					);
				}),
			);
};
