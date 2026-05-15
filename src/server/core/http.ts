// Idea 3: Server as Observable source
// Node's http.createServer wrapped so every incoming request is a stream emission.

import * as http from 'http';
import { Observable } from 'rxjs';
import { z } from 'zod';
import type { HttpRequest, HttpResponse } from './types';

interface RequestEvent {
	request: HttpRequest;
	respond: (res: HttpResponse) => void;
}

const MAX_BODY_BYTES = 1024 * 1024;
const JsonBodySchema = z.json();

export class BadRequestError extends Error {
	constructor(message = 'Malformed JSON') {
		super(message);
	}
}

export class PayloadTooLargeError extends Error {
	constructor() {
		super('Request body too large');
	}
}

export const parseBody = (req: http.IncomingMessage): Promise<unknown> =>
	new Promise((resolve, reject) => {
		let raw = '';
		let receivedBytes = 0;
		let tooLarge = false;

		req.on('data', chunk => {
			receivedBytes += Buffer.byteLength(chunk);
			if (receivedBytes > MAX_BODY_BYTES) {
				tooLarge = true;
				return;
			}
			raw += chunk;
		});
		req.on('end', () => {
			if (tooLarge) {
				reject(new PayloadTooLargeError());
				return;
			}
			if (raw.length === 0) {
				resolve({});
				return;
			}

			try {
				const parsed: unknown = JSON.parse(raw);
				const result = JsonBodySchema.safeParse(parsed);
				if (!result.success) {
					reject(new BadRequestError('JSON body contains unsupported values'));
					return;
				}
				resolve(result.data);
			} catch {
				reject(new BadRequestError());
			}
		});
		req.on('error', () => reject(new BadRequestError('Request stream error')));
	});

const parseQuery = (raw: string): Record<string, string> => {
	const params: Record<string, string> = {};
	new URLSearchParams(raw).forEach((v, k) => { params[k] = v; });
	return params;
};

export const createServer = (port: number): Observable<RequestEvent> =>
	new Observable(observer => {
		const server = http.createServer(async (req, res) => {
			const [pathname, search = ''] = (req.url ?? '/').split('?');

			const respond = ({ status = 200, body: resBody, headers = {} }: HttpResponse): void => {
				res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
				res.end(resBody !== undefined ? JSON.stringify(resBody) : '');
			};

			try {
				const body = await parseBody(req);
				const request: HttpRequest = {
					method:  req.method ?? 'GET',
					url:     pathname,
					params:  {},
					query:   parseQuery(search),
					body,
					headers: req.headers as Record<string, string>,
					raw:     req,
				};

				observer.next({ request, respond });
			} catch (err) {
				if (err instanceof PayloadTooLargeError) {
					respond({ status: 413, body: { error: err.message } });
					return;
				}
				if (err instanceof BadRequestError) {
					respond({ status: 400, body: { error: err.message } });
					return;
				}
				respond({ status: 500, body: { error: 'Internal server error' } });
			}
		});

		server.listen(port, () => console.log(`rxjs-stack server on http://localhost:${port}`));
		return () => server.close();
	});
