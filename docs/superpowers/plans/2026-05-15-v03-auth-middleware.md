# v0.3 Auth Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `requireAuth(verify, options?)` — an app-wide Effect wrapper that extracts a Bearer token, calls a user-provided verify function, stores claims in `requestContext.state.user`, and returns 401 on failure.

**Architecture:** `requireAuth` follows the same `(effect: Effect) => Effect` shape as `cors()`. It is wired via a new `auth?` field in `AppOptions`. Inside `createApp`, `auth` wraps the base router first, then `cors` wraps the result — so `OPTIONS` preflight is handled by `cors` before `auth` ever sees it.

**Tech Stack:** TypeScript strict, RxJS 7, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/server/core/middleware.ts` | Add `AuthOptions` interface and `requireAuth()` |
| `src/server/core/middleware.test.ts` | Add `requireAuth()` test suite |
| `src/server/core/app.ts` | Add `auth?` to `AppOptions`; apply in `createApp` after cors |
| `src/server/core/app.test.ts` | Add auth+cors integration test |
| `src/claude-md.test.ts` | Add `requireAuth` living-doc tests |
| `CLAUDE.md` | Document `requireAuth` usage pattern |

---

## Task 1: Write failing tests for `requireAuth()`

**Files:**
- Modify: `src/server/core/middleware.test.ts`

- [ ] **Add the `requireAuth()` import** to the existing import line at the top of the file:

```typescript
import { cors, logger, requestId, requireAuth } from './middleware';
```

The full import block at the top of `src/server/core/middleware.test.ts` should be:

```typescript
import { firstValueFrom, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { vi } from 'vitest';
import { cors, logger, requestId, requireAuth } from './middleware';
import type { Effect, HttpRequest, HttpResponse } from './types';
import type * as http from 'http';
```

- [ ] **Append the `requireAuth()` describe block** to the bottom of `src/server/core/middleware.test.ts` (keep all existing tests intact):

```typescript
describe('requireAuth()', () => {
	const makeEffect = (response: HttpResponse): Effect =>
		req$ => req$.pipe(map(() => response));

	const okEffect = makeEffect({ status: 200, body: 'ok' });

	it('passes the request through when the token is valid', async () => {
		const verify = vi.fn().mockResolvedValue({ id: '42' });
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Bearer valid-token' } }))),
		);
		expect(res.status).toBe(200);
		expect(verify).toHaveBeenCalledWith('valid-token');
	});

	it('stores claims in requestContext.state.user', async () => {
		const claims = { id: '42', role: 'admin' };
		let captured: unknown;
		const captureEffect: Effect = req$ =>
			req$.pipe(map(req => {
				captured = req.requestContext.state.user;
				return { status: 200 };
			}));
		const wrapped = requireAuth(vi.fn().mockResolvedValue(claims))(captureEffect);
		await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Bearer t' } }))),
		);
		expect(captured).toEqual(claims);
	});

	it('returns 401 when Authorization header is missing', async () => {
		const wrapped = requireAuth(vi.fn())(okEffect);
		const res = await firstValueFrom(wrapped(of(mockReq({ headers: {} }))));
		expect(res.status).toBe(401);
	});

	it('returns 401 when Authorization header is not Bearer format', async () => {
		const wrapped = requireAuth(vi.fn())(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Basic dXNlcjpwYXNz' } }))),
		);
		expect(res.status).toBe(401);
	});

	it('returns 401 (not 500) when verify throws', async () => {
		const verify = vi.fn().mockRejectedValue(new Error('invalid signature'));
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ headers: { authorization: 'Bearer bad-token' } }))),
		);
		expect(res.status).toBe(401);
	});

	it('bypasses auth for paths in the explicit exclude list', async () => {
		const verify = vi.fn();
		const wrapped = requireAuth(verify, { exclude: ['/login'] })(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ url: '/login', headers: {} }))),
		);
		expect(res.status).toBe(200);
		expect(verify).not.toHaveBeenCalled();
	});

	it('bypasses auth for /health by default', async () => {
		const verify = vi.fn();
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ url: '/health', headers: {} }))),
		);
		expect(res.status).toBe(200);
		expect(verify).not.toHaveBeenCalled();
	});

	it('bypasses auth for /ready by default', async () => {
		const verify = vi.fn();
		const wrapped = requireAuth(verify)(okEffect);
		const res = await firstValueFrom(
			wrapped(of(mockReq({ url: '/ready', headers: {} }))),
		);
		expect(res.status).toBe(200);
		expect(verify).not.toHaveBeenCalled();
	});
});
```

- [ ] **Run the new tests to confirm they fail**

```
npx vitest run src/server/core/middleware.test.ts
```

Expected: FAIL — `requireAuth is not exported` / `requireAuth is not a function`.

---

## Task 2: Implement `requireAuth()` in `middleware.ts`

**Files:**
- Modify: `src/server/core/middleware.ts`

- [ ] **Replace the entire contents of `src/server/core/middleware.ts`** with:

```typescript
import { catchError, from, map, mergeMap, of, tap } from 'rxjs';
import { Unauthorized, errorResponse } from './errors';
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

export interface AuthOptions {
	exclude?: string[];
}

export const requireAuth = <TClaims>(
	verify: (token: string) => TClaims | Promise<TClaims>,
	options: AuthOptions = {},
): (effect: Effect) => Effect => {
	const exclude = options.exclude ?? ['/health', '/ready'];

	return (effect: Effect): Effect =>
		req$ =>
			req$.pipe(
				mergeMap(req => {
					if (exclude.includes(req.url)) {
						return effect(of(req));
					}

					const authHeader = req.headers['authorization'];
					if (!authHeader?.startsWith('Bearer ')) {
						return of(errorResponse(new Unauthorized()));
					}

					const token = authHeader.slice(7);
					return from((async () => verify(token))()).pipe(
						mergeMap(claims => {
							const enriched = {
								...req,
								requestContext: {
									...req.requestContext,
									state: { ...req.requestContext.state, user: claims },
								},
							};
							return effect(of(enriched));
						}),
						catchError(() => of(errorResponse(new Unauthorized()))),
					);
				}),
			);
};
```

- [ ] **Run the requireAuth tests**

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
git commit -m "feat: add requireAuth() Effect wrapper with Bearer token extraction and path exclusions"
```

---

## Task 3: Wire `auth` into `createApp`

**Files:**
- Modify: `src/server/core/app.ts`
- Modify: `src/server/core/app.test.ts`

- [ ] **Update the import line** at the top of `src/server/core/app.test.ts` — add `requireAuth` to the existing middleware import:

```typescript
import { cors, requireAuth } from './middleware';
```

- [ ] **Append the failing test describe block** to the bottom of `src/server/core/app.test.ts`:

```typescript
describe('createApp() — auth option', () => {
	const testRoutes = [
		get('/secret', req$ => req$.pipe(map(() => json('classified')))),
	];

	it('returns 401 when no token is provided', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({ url: '/secret', headers: {} }))),
		);
		expect(res.status).toBe(401);
	});

	it('returns 200 when a valid token is provided', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({
				url: '/secret',
				headers: { authorization: 'Bearer valid' },
			}))),
		);
		expect(res.status).toBe(200);
	});

	it('cors + auth — OPTIONS preflight bypasses auth', async () => {
		const app = createApp(testRoutes, {
			cors: cors(),
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({
				method: 'OPTIONS',
				url: '/secret',
				headers: {},
			}))),
		);
		expect(res.status).toBe(204);
	});

	it('/health bypasses auth by default', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(() => Promise.resolve({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({ url: '/health', headers: {} }))),
		);
		expect(res.status).toBe(200);
	});
});
```

- [ ] **Run the new tests to confirm they fail**

```
npx vitest run src/server/core/app.test.ts
```

Expected: FAIL — `AppOptions` has no `auth` property.

- [ ] **Update `src/server/core/app.ts`** — two changes:

**Change 1** — add `auth?` to `AppOptions` (after `cors?`):

```typescript
export interface AppOptions<TServices extends Record<string, unknown>> {
	services?: TServices;
	middlewares?: Middleware[];
	cors?: (effect: Effect) => Effect;
	auth?: (effect: Effect) => Effect;
	onStart?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
	onStop?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
	includeHealthRoutes?: boolean;
}
```

**Change 2** — replace the `const baseRouter / const router` block inside `createApp`:

```typescript
// Before:
	const baseRouter = createRouter(allRoutes, context);
	const router = options.cors ? options.cors(baseRouter) : baseRouter;

// After:
	const baseRouter = createRouter(allRoutes, context);
	const authRouter = options.auth ? options.auth(baseRouter) : baseRouter;
	const router     = options.cors ? options.cors(authRouter) : authRouter;
```

- [ ] **Run the app tests**

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
git commit -m "feat: wire requireAuth() into createApp via AppOptions.auth"
```

---

## Task 4: CLAUDE.md update + living-doc tests

**Files:**
- Modify: `CLAUDE.md`
- Modify: `src/claude-md.test.ts`

- [ ] **Add the `requireAuth` section to `CLAUDE.md`** — insert after the `app.router` example block (after the closing ` ``` ` on line ~68), before the `### Shared route contracts` heading:

```markdown
`requireAuth(verify, options?)` protects the app with a bring-your-own verifier. It reads `Authorization: Bearer <token>`, calls `verify`, and stores the result at `req.requestContext.state.user`. Returns 401 directly on missing/invalid tokens — no throw needed. `/health` and `/ready` are excluded by default:

```typescript
createApp(routes, {
	cors: cors(),
	auth: requireAuth(
		async token => {
			// decode / validate however you like — throw to reject
			const payload = await myJwtVerify(token);
			return payload;                    // stored as req.requestContext.state.user
		},
		{ exclude: ['/login'] },
	),
});
```

Access claims inside a route effect:

```typescript
get('/profile', req$ => req$.pipe(
	map(req => {
		const user = req.requestContext.state.user as { id: string };
		return json({ id: user.id });
	}),
))
```
```

- [ ] **Add `requireAuth` to the import line** at the top of `src/claude-md.test.ts`:

```typescript
import { cors, requireAuth } from './server/core/middleware';
```

- [ ] **Append the living-doc describe block** to the bottom of `src/claude-md.test.ts`:

```typescript
// ---------------------------------------------------------------------------
// requireAuth() via createApp — CLAUDE.md "Server layers" section
// ---------------------------------------------------------------------------

describe('CLAUDE.md — requireAuth() via createApp', () => {
	const testRoutes = [
		get('/profile', req$ => req$.pipe(map(() => json({ id: '42' })))),
	];

	it('valid token — request passes through and claims are stored in requestContext.state.user', async () => {
		const claims = { id: '99', role: 'admin' };
		let captured: unknown;
		const captureRoutes = [
			get('/profile', req$ => req$.pipe(
				map(req => {
					captured = req.requestContext.state.user;
					return json({ id: '42' });
				}),
			)),
		];
		const app = createApp(captureRoutes, {
			auth: requireAuth(async () => claims),
		});
		await firstValueFrom(
			app.router(of(createTestRequest({
				url: '/profile',
				headers: { authorization: 'Bearer my-token' },
			}))),
		);
		expect(captured).toEqual(claims);
	});

	it('missing token returns 401', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(async () => ({ id: '1' })),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({ url: '/profile', headers: {} }))),
		);
		expect(res.status).toBe(401);
	});

	it('excluded path bypasses auth entirely', async () => {
		const app = createApp(testRoutes, {
			auth: requireAuth(async () => { throw new Error('should not be called'); }, {
				exclude: ['/profile'],
			}),
		});
		const res = await firstValueFrom(
			app.router(of(createTestRequest({ url: '/profile', headers: {} }))),
		);
		expect(res.status).toBe(200);
	});
});
```

- [ ] **Run the new tests**

```
npx vitest run src/claude-md.test.ts
```

Expected: all tests PASS.

- [ ] **Run the full test suite and typecheck**

```
npm test && npm run typecheck
```

Expected: all tests PASS, no type errors.

- [ ] **Commit**

```
git add CLAUDE.md src/claude-md.test.ts
git commit -m "docs: document requireAuth() in CLAUDE.md with living-doc tests"
```

---

## Final step: push

```
git push
```
