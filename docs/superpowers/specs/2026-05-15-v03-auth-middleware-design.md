# v0.3 Auth Middleware — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

---

## Overview

Add `requireAuth()` — an app-wide authentication Effect wrapper that extracts a Bearer token, calls a user-provided verify function, stores the resulting claims in `requestContext.state.user`, and short-circuits with 401 on failure.

---

## Interface

```typescript
// src/server/core/middleware.ts

export interface AuthOptions {
    exclude?: string[];   // paths that bypass auth — default: ['/health', '/ready']
}

export const requireAuth = <TClaims>(
    verify: (token: string) => TClaims | Promise<TClaims>,
    options?: AuthOptions,
): (effect: Effect) => Effect
```

`verify` is bring-your-own — the middleware owns only header extraction, path exclusion, and 401 short-circuiting. JWT parsing, API key lookup, or any other verification strategy is the caller's responsibility.

---

## Data flow

Per request:

1. If `req.url` is in the exclude list (default `['/health', '/ready']`) → pass through without auth check
2. Read `Authorization` header — if missing or not `Bearer <token>` format → throw `Unauthorized`
3. Call `verify(token)` — if it throws for any reason → throw `Unauthorized` (never 500)
4. Store result at `req.requestContext.state.user` as `TClaims`
5. Pass enriched request downstream

Claims access in a route effect:

```typescript
get('/profile', req$ => req$.pipe(
    map(req => {
        const user = req.requestContext.state.user as MyUser;
        return json({ id: user.id, email: user.email });
    }),
))
```

No new fields on `HttpRequest` or `RequestContext` — `requestContext.state` is already `Record<string, unknown>`, consistent with the `requestId` convention.

---

## AppOptions integration

```typescript
// src/server/core/app.ts

export interface AppOptions<TServices extends Record<string, unknown>> {
    services?: TServices;
    middlewares?: Middleware[];
    cors?: (effect: Effect) => Effect;
    auth?: (effect: Effect) => Effect;   // new
    onStart?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
    onStop?: Array<(context: AppContext<TServices>) => void | Promise<void>>;
    includeHealthRoutes?: boolean;
}
```

Wrapper order inside `createApp` — `cors` outermost, `auth` inside it:

```typescript
const baseRouter = createRouter(allRoutes, context);
const authRouter  = options.auth ? options.auth(baseRouter)  : baseRouter;
const router      = options.cors ? options.cors(authRouter)  : authRouter;
```

`cors` is outermost so `OPTIONS` preflight is short-circuited before `auth` ever sees it — no token required for CORS preflight. Usage:

```typescript
createApp(routes, {
    cors: cors(),
    auth: requireAuth(verify, { exclude: ['/login'] }),
});
```

---

## Error behaviour

| Condition | Response |
|---|---|
| Path in exclude list | Pass through — no auth check |
| Missing `Authorization` header | `Unauthorized` → 401 |
| Header present but not `Bearer <token>` | `Unauthorized` → 401 |
| `verify(token)` throws | `Unauthorized` → 401 (never propagated as 500) |
| `verify(token)` resolves | Claims stored, request continues |

---

## Files changed

| File | Change |
|---|---|
| `src/server/core/middleware.ts` | Add `AuthOptions` interface and `requireAuth()` |
| `src/server/core/app.ts` | Add `auth?` to `AppOptions`; apply in `createApp` after `cors` |
| `src/server/core/middleware.test.ts` | Add `requireAuth()` test suite |
| `src/server/core/app.test.ts` | Add auth+cors integration test |
| `src/claude-md.test.ts` | Add `requireAuth` living-doc tests |

---

## Test coverage

### `requireAuth()` in `middleware.test.ts`

| Test | Assertion |
|---|---|
| Valid token | 200, `requestContext.state.user` equals claims |
| Missing `Authorization` header | 401 |
| Non-Bearer header (`Basic xyz`) | 401 |
| `verify` throws | 401, not 500 |
| Path in explicit `exclude` list | 200, no auth check |
| `/health` with no token (default exclude) | passes through |

### `app.test.ts` — integration

| Test | Assertion |
|---|---|
| `cors` + `auth` both wired — OPTIONS bypasses auth | 204, no auth check |

### `claude-md.test.ts` — living documentation

| Test | Assertion |
|---|---|
| `requireAuth` with valid token stores claims in `requestContext.state.user` | claims accessible |
| `requireAuth` with no token returns 401 | status 401 |
| `requireAuth` with excluded path passes through | no auth check |

---

## Acceptance criteria

- `npm test` passes
- `npm run typecheck` passes
- `requireAuth` is exported from `middleware.ts`
- `AppOptions.auth` accepts any `(effect: Effect) => Effect` — `requireAuth(verify)` satisfies this
- OPTIONS preflight bypasses auth when both `cors` and `auth` are wired
- `/health` and `/ready` bypass auth by default
