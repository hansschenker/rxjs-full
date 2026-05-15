# v0.2 Feature Complete — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

---

## Overview

Four targeted additions to reach v0.2 feature complete:

1. `cors()` middleware
2. `errors.test.ts` — test coverage for `HttpError` and `errorResponse()`
3. CHANGELOG `[Unreleased]` section documenting the framework layer
4. README fixes — structure diagram, API examples, test count

---

## 1. `cors()` Middleware

### Approach

`cors()` returns an Effect wrapper — `(effect: Effect) => Effect`. Using `mergeMap` over each individual request it can read the `Origin` header from the request and pair it with the response, enabling both:

- **Preflight** — `OPTIONS` requests are short-circuited and return 204 with CORS headers immediately (the wrapped effect is never called).
- **Response headers** — all other responses get `Access-Control-Allow-Origin` (and optionally `Access-Control-Allow-Credentials`) merged into their headers.

### Interface

```typescript
// src/server/core/middleware.ts

export interface CorsOptions {
    origins?: string[] | '*';     // '*' = wildcard, default '*'
    methods?: string[];           // Access-Control-Allow-Methods, default GET,POST,PUT,DELETE,OPTIONS
    allowedHeaders?: string[];    // Access-Control-Allow-Headers, default Content-Type,Authorization
    maxAge?: number;              // Access-Control-Max-Age in seconds, default 86400
    credentials?: boolean;        // Access-Control-Allow-Credentials, default false
}

export const cors = (options?: CorsOptions): (effect: Effect) => Effect
```

### Origin resolution

- If `origins === '*'`: always respond with `Access-Control-Allow-Origin: *`.
- If `origins` is an array: echo the incoming `Origin` header only if it matches; omit the header otherwise (browser treats absence as denial).
- `credentials: true` is incompatible with `origins: '*'`; the implementation silently coerces to no wildcard when credentials are enabled.

### AppOptions integration

```typescript
// src/server/core/app.ts — AppOptions change
cors?: (effect: Effect) => Effect;

// In createApp, before bootstrap:
const baseRouter = createRouter(allRoutes, context);
const router = options.cors ? options.cors(baseRouter) : baseRouter;
subscription = bootstrap(port, router, ...(options.middlewares ?? []));
```

### Usage example

```typescript
createApp(routes, {
    middlewares: [requestId(), logger()],
    cors: cors({ origins: ['http://localhost:5173'] }),
    services: { todoStore: createTodoStore() },
});
```

### Files changed

| File | Change |
|---|---|
| `src/server/core/types.ts` | No change needed |
| `src/server/core/middleware.ts` | Add `CorsOptions`, `cors()` |
| `src/server/core/app.ts` | Add `cors?` to `AppOptions`, apply in `start()` |
| `src/server/core/middleware.test.ts` | Add cors tests |

---

## 2. `errors.test.ts`

New file `src/server/core/errors.test.ts`.

### Coverage

**`HttpError` subclasses**
- Each class (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `UnprocessableEntity`) sets the correct default status and message.
- `details` is stored and accessible.
- Custom message overrides the default.

**`errorResponse(HttpError)`**
- Returns `{ status, body: { error: message } }` when no details.
- Returns `{ status, body: { error, details } }` when details present.

**`errorResponse(unknown)`**
- Unknown errors return `{ status: 500, body: { error: 'Internal server error' } }`.
- `console.error` is called with the original error.

---

## 3. CHANGELOG `[Unreleased]`

New section added above `[1.0.0]`:

```markdown
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
- Shared route contracts (`src/shared/routes.ts`) with `RouteParams`/`RouteBody`/`RouteResponse`/`RouteQuery` type utilities
- `createClient(routes)` — derives a typed Observable client tree directly from the shared route contract
- Fixed: `defineRoute` now correctly propagates query-parameter presence to the runtime client
```

---

## 4. README Fixes

| Location | Current | Fix |
|---|---|---|
| Project structure | Missing `src/shared/routes.ts`, `src/client/api.ts` | Add both with descriptions |
| v0.2 client example | `api.todos.list()` | `api.todos.list({})` |
| `todo.service.ts` comment | "fromFetch wrappers for the API" | "typed client wrappers via `createClient`" |
| Getting started | "run all 78 tests" | "run all tests" |
| Bootstrap example | `bootstrap(3000, router, logger(), cors())` | `createApp`-based usage showing `cors:` option |

---

## Acceptance Criteria

- `npm test` passes (including new cors and errors tests)
- `npm run typecheck` passes
- CHANGELOG has an `[Unreleased]` section listing all v0.2 additions
- README structure diagram includes `src/shared/routes.ts` and `src/client/api.ts`
- `api.todos.list({})` in README (no type error)
