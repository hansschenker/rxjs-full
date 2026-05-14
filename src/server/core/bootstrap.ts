// Connects the Observable server source to the router Effect.
// Every request emission flows through optional middlewares then into the router.

import { of } from 'rxjs';
import { mergeMap, tap } from 'rxjs/operators';
import { createServer } from './http';
import type { Effect, Middleware } from './types';

export const bootstrap = (port: number, router: Effect, ...middlewares: Middleware[]): void => {
	createServer(port).pipe(
		mergeMap(({ request, respond }) => {
			const piped = middlewares.reduce(
				(src$, mw) => src$.pipe(mw),
				of(request),
			);
			return router(piped).pipe(
				tap(response => respond(response)),
			);
		}),
	).subscribe({
		error: err => console.error('Unhandled server error:', err),
	});
};
