// Idea 3: Server as Observable source
// Node's http.createServer wrapped so every incoming request is a stream emission.

import * as http from 'http';
import { Observable } from 'rxjs';
import type { HttpRequest, HttpResponse } from './types';

interface RequestEvent {
	request: HttpRequest;
	respond: (res: HttpResponse) => void;
}

const parseBody = (req: http.IncomingMessage): Promise<unknown> =>
	new Promise(resolve => {
		let raw = '';
		req.on('data', chunk => { raw += chunk; });
		req.on('end', () => {
			try { resolve(JSON.parse(raw)); }
			catch { resolve({}); }
		});
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

			const respond = ({ status = 200, body: resBody, headers = {} }: HttpResponse): void => {
				res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
				res.end(resBody !== undefined ? JSON.stringify(resBody) : '');
			};

			observer.next({ request, respond });
		});

		server.listen(port, () => console.log(`rxjs-full server on http://localhost:${port}`));
		return () => server.close();
	});
