# v0.2 Feature Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `cors()` middleware, test coverage for `errors.ts`, a CHANGELOG `[Unreleased]` section, and five README fixes to bring the project to v0.2 feature complete.

**Architecture:** `cors()` is implemented as an Effect wrapper `(effect: Effect) => Effect` that intercepts OPTIONS preflight requests and injects response headers for all others. It is wired into `createApp` via a new `cors?` field in `AppOptions`. The other tasks are pure test/doc additions with no architectural impact.

**Tech Stack:** TypeScript strict, RxJS 7, Zod, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/server/core/middleware.ts` | Add `CorsOptions` interface and `cors()` function |
| `src/server/core/middleware.test.ts` | Add `cors()` test suite |
| `src/server/core/app.ts` | Add `cors?` to `AppOptions`, add `router` to `App`, wire in `createApp` |
| `src/server/core/app.test.ts` | Add cors-wiring test |
| `src/server/core/errors.test.ts` | Create — test `HttpError` subclasses and `errorResponse()` |
| `CHANGELOG.md` | Add `[Unreleased]` section |
| `README.md` | Five targeted fixes |

---

## Task 1: Write failing tests for `cors()`

**Files:**
- Modify: `src/server/core/middleware.test.ts`

- [ ] **Add the cors test suite** to the bottom of `src/server/core/middleware.test.ts` (keep all existing tests intact):

```typescript
import { firstValueFrom, of } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Observable } from 'rxjs';
import { cors } from './middleware';
import type { HttpResponse } from './types';

// Add this describe block at the bottom of the file

describe('cors()', () => {
	const makeEffect = (response: HttpResponse): Effect =>
		req$ => req$.pipe(map(() => response));

	it('adds Access-Control-Allow-Origin: * to responses by default', async () => {
		const wrapped = cors()(makeEffect({ status: 200, body: 'ok' }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: {} }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
	});

	it('returns 204 for OPTIONS preflight with CORS headers', async () => {
		const wrapped = cors()(makeEffect({ status: 200, body: 'ok' }));
		const res = await firstValueFrom(wrapped(of(mockReq({ method: 'OPTIONS', headers: {} }))));
		expect(res.status).toBe(204);
		expect(res.headers?.['Access-Control-Allow-Methods']).toContain('GET');
		expect(res.headers?.['Access-Control-Allow-Headers']).toContain('Content-Type');
		expect(res.headers?.['Access-Control-Max-Age']).toBe('86400');
	});

	it('does not call the wrapped effect for OPTIONS requests', async () => {
		const effectSpy = vi.fn((_req$: Observable<HttpRequest>) => of({ status: 200 } as HttpResponse));
		const wrapped = cors()(effectSpy as unknown as Effect);
		await firstValueFrom(wrapped(of(mockReq({ method: 'OPTIONS', headers: {} }))));
		expect(effectSpy).not.toHaveBeenCalled();
	});

	it('echoes a matching origin from the allowlist', async () => {
		const wrapped = cors({ origins: ['http://localhost:5173'] })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://localhost:5173' } }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
	});

	it('omits Access-Control-Allow-Origin for a non-matching origin', async () => {
		const wrapped = cors({ origins: ['http://localhost:5173'] })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://evil.com' } }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
	});

	it('adds Access-Control-Allow-Credentials when credentials is true', async () => {
		const wrapped = cors({ credentials: true, origins: ['http://localhost:5173'] })(
			makeEffect({ status: 200 }),
		);
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://localhost:5173' } }))));
		expect(res.headers?.['Access-Control-Allow-Credentials']).toBe('true');
	});

	it('echoes the request origin instead of * when credentials is true', async () => {
		const wrapped = cors({ credentials: true })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: { origin: 'http://localhost:5173' } }))));
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
	});

	it('does not override existing response headers', async () => {
		const wrapped = cors()(makeEffect({ status: 200, headers: { 'X-Custom': 'value' } }));
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: {} }))));
		expect(res.headers?.['X-Custom']).toBe('value');
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
	});

	it('respects a custom maxAge', async () => {
		const wrapped = cors({ maxAge: 3600 })(makeEffect({ status: 200 }));
		const res = await firstValueFrom(wrapped(of(mockReq({ method: 'OPTIONS', headers: {} }))));
		expect(res.headers?.['Access-Control-Max-Age']).toBe('3600');
	});
});
```

Note: `mockReq` and `vi` are already in the file. The file currently has duplicate `vi` and `map` imports at the bottom (lines 49–50) — remove those when consolidating. Replace the entire import section (top + bottom) with this single block at the top:

```typescript
import { firstValueFrom, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { vi } from 'vitest';
import { cors, logger, requestId } from './middleware';
import type { Effect, HttpRequest, HttpResponse } from './types';
import type * as http from 'http';
```

- [ ] **Run the new tests to confirm they fail**

```
npx vitest run src/server/core/middleware.test.ts
```

Expected: several FAIL — `cors is not a function` / `cors is not exported`.

---

## Task 2: Implement `cors()` in `middleware.ts`

**Files:**
- Modify: `src/server/core/middleware.ts`

- [ ] **Replace the entire contents of `src/server/core/middleware.ts`** with:

```typescript
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
```

- [ ] **Run the cors tests to confirm they pass**

```
npx vitest run src/server/core/middleware.test.ts
```

Expected: all tests PASS.

- [ ] **Run the full test suite**

```
npm test
```

Expected: all tests PASS.

- [ ] **Commit**

```
git add src/server/core/middleware.ts src/server/core/middleware.test.ts
git commit -m "feat: add cors() middleware with preflight support and origin allowlist"
```

---

## Task 3: Wire `cors` into `createApp`

**Files:**
- Modify: `src/server/core/app.ts`
- Modify: `src/server/core/app.test.ts`

- [ ] **Write the failing test** — add to the bottom of `src/server/core/app.test.ts`:

```typescript
import { cors } from './middleware';
import { createTestRequest } from './testing';

// Add inside the existing describe block or as a new one:

describe('createApp() — cors option', () => {
	it('applies the cors wrapper so OPTIONS requests receive preflight headers', async () => {
		const app = createApp([
			get('/test', req$ => req$.pipe(map(() => json('ok')))),
		], { cors: cors() });

		const res = await firstValueFrom(app.router(of(createTestRequest({
			method: 'OPTIONS',
			url: '/test',
			headers: {},
		}))));

		expect(res.status).toBe(204);
		expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
	});

	it('leaves the router unwrapped when no cors option is given', async () => {
		const app = createApp([
			get('/test', req$ => req$.pipe(map(() => json('ok')))),
		]);

		const res = await firstValueFrom(app.router(of(createTestRequest({ url: '/test' }))));
		expect(res.status).toBe(200);
		expect(res.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
	});
});
```

The full updated import block for `app.test.ts` should be:

```typescript
import { firstValueFrom, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { createApp } from './app';
import { cors } from './middleware';
import { createRouter, get, group } from './router';
import { json } from './response';
import { createTestRequest } from './testing';
```

- [ ] **Run the new tests to confirm they fail**

```
npx vitest run src/server/core/app.test.ts
```

Expected: FAIL — `app.router is not a function` / property does not exist.

- [ ] **Update `src/server/core/app.ts`** — three changes:

**Change 1** — update the import line (line 6):
```typescript
// Before:
import type { AppContext, Middleware } from './types';

// After:
import type { AppContext, Effect, Middleware } from './types';
```

**Change 2** — add `cors?` to `AppOptions` and `router` to `App`:
```typescript
// Before:
export interface AppOptions<TServices extends Record<string, unknown>> {
	services?: TServices;
	middlewares?: Middleware[];
	onStart?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
	onStop?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
	includeHealthRoutes?: boolean;
}

export interface App<TServices extends Record<string, unknown>> {
	context: AppContext<TServices>;
	routes: RouteDefinition[];
	start: (port: number) => Promise<Subscription>;
	stop: () => Promise<void>;
}

// After:
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
```

**Change 3** — update the `createApp` body (replace the `const router = ...` line and the returned object):
```typescript
// Before:
	const router = createRouter(allRoutes, context);
	let subscription: Subscription | null = null;

	return {
		context,
		routes: allRoutes,

// After:
	const baseRouter = createRouter(allRoutes, context);
	const router = options.cors ? options.cors(baseRouter) : baseRouter;
	let subscription: Subscription | null = null;

	return {
		context,
		routes: allRoutes,
		router,
```

- [ ] **Run the app tests to confirm they pass**

```
npx vitest run src/server/core/app.test.ts
```

Expected: all tests PASS.

- [ ] **Run the full test suite and typecheck**

```
npm test && npm run typecheck
```

Expected: all tests PASS, no type errors.

- [ ] **Commit**

```
git add src/server/core/app.ts src/server/core/app.test.ts
git commit -m "feat: wire cors() into createApp via AppOptions.cors"
```

---

## Task 4: `errors.test.ts` — test coverage for `HttpError` and `errorResponse`

**Files:**
- Create: `src/server/core/errors.test.ts`

- [ ] **Create `src/server/core/errors.test.ts`** with this content:

```typescript
import { vi } from 'vitest';
import {
	BadRequest,
	Forbidden,
	HttpError,
	NotFound,
	Unauthorized,
	UnprocessableEntity,
	errorResponse,
} from './errors';

describe('HttpError base class', () => {
	it('stores status and message', () => {
		const err = new HttpError(418, "I'm a teapot");
		expect(err.status).toBe(418);
		expect(err.message).toBe("I'm a teapot");
	});

	it('stores optional details', () => {
		const err = new HttpError(400, 'Bad', { field: 'title' });
		expect(err.details).toEqual({ field: 'title' });
	});

	it('details is undefined when not provided', () => {
		const err = new HttpError(400, 'Bad');
		expect(err.details).toBeUndefined();
	});

	it('is an instance of Error', () => {
		expect(new HttpError(500, 'oops')).toBeInstanceOf(Error);
	});
});

describe('HttpError subclasses', () => {
	it('BadRequest has status 400 and default message', () => {
		const err = new BadRequest();
		expect(err.status).toBe(400);
		expect(err.message).toBe('Bad request');
	});

	it('Unauthorized has status 401 and default message', () => {
		const err = new Unauthorized();
		expect(err.status).toBe(401);
		expect(err.message).toBe('Unauthorized');
	});

	it('Forbidden has status 403 and default message', () => {
		const err = new Forbidden();
		expect(err.status).toBe(403);
		expect(err.message).toBe('Forbidden');
	});

	it('NotFound has status 404 and default message', () => {
		const err = new NotFound();
		expect(err.status).toBe(404);
		expect(err.message).toBe('Not found');
	});

	it('UnprocessableEntity has status 422 and default message', () => {
		const err = new UnprocessableEntity();
		expect(err.status).toBe(422);
		expect(err.message).toBe('Validation failed');
	});

	it('accepts a custom message', () => {
		expect(new NotFound('Todo not found').message).toBe('Todo not found');
	});

	it('accepts details', () => {
		expect(new BadRequest('oops', { field: 'id' }).details).toEqual({ field: 'id' });
	});
});

describe('errorResponse(HttpError)', () => {
	it('returns the correct status code', () => {
		expect(errorResponse(new NotFound()).status).toBe(404);
	});

	it('returns body with error message when no details', () => {
		expect(errorResponse(new NotFound('Missing')).body).toEqual({ error: 'Missing' });
	});

	it('includes details in body when present', () => {
		const res = errorResponse(new BadRequest('Bad', { field: 'x' }));
		expect(res.body).toEqual({ error: 'Bad', details: { field: 'x' } });
	});
});

describe('errorResponse(unknown)', () => {
	it('returns 500 for a non-HttpError', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = errorResponse(new Error('boom'));
		expect(res.status).toBe(500);
		expect(res.body).toEqual({ error: 'Internal server error' });
		spy.mockRestore();
	});

	it('calls console.error with the original error', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const err = new Error('boom');
		errorResponse(err);
		expect(spy).toHaveBeenCalledWith(err);
		spy.mockRestore();
	});

	it('returns 500 for non-Error values', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const res = errorResponse('plain string error');
		expect(res.status).toBe(500);
		spy.mockRestore();
	});
});
```

- [ ] **Run the new tests**

```
npx vitest run src/server/core/errors.test.ts
```

Expected: all tests PASS (the implementation already exists).

- [ ] **Commit**

```
git add src/server/core/errors.test.ts
git commit -m "test: add coverage for HttpError hierarchy and errorResponse()"
```

---

## Task 5: CHANGELOG `[Unreleased]` section

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Insert the `[Unreleased]` section** immediately after the `---` separator on line 5 (before `## [1.0.0]`). The final file should read:

```markdown
# Changelog

All notable changes to rxjs-stack are documented here.

---

## [Unreleased]

### Added

**Application framework layer (v0.2)**
- `createApp()` — injectable services, per-app context, lifecycle hooks, `/health` + `/ready`
- Route helpers: `get()`, `post()`, `put()`, `del()`, `group()`, `handle()`
- `cors()` — CORS middleware with preflight support, origin allowlist, and credentials option
- `requestId()` middleware
- `HttpError` class hierarchy (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `UnprocessableEntity`)
- Response helpers: `json()`, `created()`, `noContent()`, `redirect()`, `withHeader()`, `withCookie()`
- Zod validators: `validateBody()`, `validateParams()`, `validateQuery()`
- Testing helpers: `runEffect()`, `runRequest()`, `createHttpTestClient()`, `createTestContext()`, `createTestRequest()`
- Shared route contracts (`src/shared/routes.ts`) — `RouteContract`, `RouteParams`, `RouteBody`, `RouteQuery`, `RouteResponse`, `buildPath`, `apiPath`
- `createClient(routes)` — derives a typed Observable client tree directly from the shared route contract map

### Fixed
- `defineRoute` now correctly propagates query-parameter presence at runtime, enabling `createClient` to build query strings from the contract

---

## [1.0.0] — 2026-05-14
```

(Leave everything from `## [1.0.0]` onward untouched.)

- [ ] **Commit**

```
git add CHANGELOG.md
git commit -m "docs: add [Unreleased] CHANGELOG section for v0.2 framework layer"
```

---

## Task 6: README fixes

**Files:**
- Modify: `README.md`

Five targeted edits. Make them one at a time to avoid conflicts.

- [ ] **Fix 1 — project structure diagram**: find the `src/` tree block and add the two missing files. The `shared/` block should become:

```
├── shared/
│   ├── types.ts          # Todo, CreateTodoBody, UpdateTodoBody — shared between client and server
│   └── routes.ts         # RouteContract definitions, RouteParams/RouteBody/RouteResponse utilities, apiPath
```

The `client/` block should become:

```
└── client/
    ├── h.ts                      # custom TSX factory (no React)
    ├── todo.state.ts             # MVU state: Subject + scan + shareReplay
    ├── todo.service.ts           # typed client wrappers via createClient
    ├── api.ts                    # createClient — typed Observable client from route contracts
    ├── components/
    │   └── todo-item.tsx         # TodoItem component
    └── main.tsx                  # app entry: fromEvent + exhaustMap form handler
```

- [ ] **Fix 2 — `api.todos.list()` call**: in the v0.2 client example block, change:

```typescript
api.todos.list();                         // Observable<Todo[]>
```

to:

```typescript
api.todos.list({});                       // Observable<Todo[]>
```

- [ ] **Fix 3 — `middleware.ts` comment in the structure diagram**: change:

```
│   │   ├── middleware.ts  # logger() middleware
```

to:

```
│   │   ├── middleware.ts  # logger(), requestId(), cors() middleware
```

- [ ] **Fix 4 — test count in Getting started**: change:

```bash
npm test          # run all 78 tests
```

to:

```bash
npm test          # run all tests
```

- [ ] **Fix 5 — bootstrap example in pattern 2 (Middleware as OperatorFunction)**: find:

```typescript
bootstrap(3000, router, logger(), cors());
```

Replace with:

```typescript
const app = createApp(routes, {
    middlewares: [requestId(), logger()],
    cors: cors({ origins: ['*'] }),
});
```

- [ ] **Run tests and typecheck one final time**

```
npm test && npm run typecheck
```

Expected: all tests PASS, no type errors.

- [ ] **Commit**

```
git add README.md
git commit -m "docs: update README for v0.2 — structure, cors example, test count"
```

---

## Final step: push

```
git push
```
