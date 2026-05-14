// Idea 2: Middleware as OperatorFunction<HttpRequest, HttpRequest>
// Each middleware is a pipe-composable operator — no framework magic needed.
// Middleware transforms the request stream; response concerns belong in effects.

import { tap } from 'rxjs/operators';
import type { Middleware } from './types';

export const logger = (): Middleware =>
	tap(req => console.log(`${req.method} ${req.url}`));
