import type { Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { bootstrap } from './bootstrap';
import { createRouter, get, type RouteDefinition } from './router';
import { json } from './response';
import type { AppContext, Effect, Middleware } from './types';

export interface AppOptions<TServices extends Record<string, unknown>> {
	services?: TServices;
	middlewares?: Middleware[];
	cors?: (effect: Effect) => Effect;
	onStart?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
	onStop?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
	includeHealthRoutes?: boolean;
}

export interface App<TServices extends Record<string, unknown>> {
	context: AppContext<TServices>;
	routes: RouteDefinition[];
	router: Effect;
	start: (port: number) => Promise<Subscription>;
	stop: () => Promise<void>;
}

export const createApp = <TServices extends Record<string, unknown> = Record<string, unknown>>(
	routes: RouteDefinition[],
	options: AppOptions<TServices> = {},
): App<TServices> => {
	const context: AppContext<TServices> = {
		services: (options.services ?? {}) as TServices,
		state: {},
	};
	const allRoutes = options.includeHealthRoutes === false
		? routes
		: [
			get('/health', req$ => req$.pipe(map(() => json({ status: 'ok' })))),
			get('/ready', req$ => req$.pipe(map(() => json({ status: 'ready' })))),
			...routes,
		];
	const baseRouter = createRouter(allRoutes, context);
	const router = options.cors ? options.cors(baseRouter) : baseRouter;
	let subscription: Subscription | null = null;

	return {
		context,
		routes: allRoutes,
		router,
		async start(port: number): Promise<Subscription> {
			for (const hook of options.onStart ?? []) await hook(context);
			subscription = bootstrap(port, router, ...(options.middlewares ?? []));
			return subscription;
		},
		async stop(): Promise<void> {
			subscription?.unsubscribe();
			for (const hook of options.onStop ?? []) await hook(context);
		},
	};
};
