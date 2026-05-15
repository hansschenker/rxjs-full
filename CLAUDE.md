# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run concurrently in two terminals)
npm run dev:server   # API server on port 3000 via tsx watch
npm run dev:client   # Vite dev server on port 5173

# Quality checks
npm test             # Vitest run (all tests)
npm run test:watch   # Vitest interactive watch mode
npm run typecheck    # tsc --noEmit strict check

# Run a single test file
npx vitest run src/server/core/router.test.ts
```

Vite proxies `/api/*` → `http://localhost:3000/*`, so the client and server can run independently.

## Architecture

This is a framework-free full-stack TypeScript app. Every abstraction is either a plain RxJS `Observable` or a function that transforms one.

### Core type contracts (`src/server/core/types.ts`)

```typescript
type Effect<TRequest>     = (req$: Observable<TRequest>)  => Observable<HttpResponse>;
type Middleware<TRequest> = OperatorFunction<TRequest, TRequest>;
```

A route handler, middleware, and the router itself are all `Effect`. Middleware is just an `OperatorFunction` — compose with `pipe()`.

### Server layers

| File | Responsibility |
|---|---|
| `src/server/core/http.ts` | Node.js `http.Server` wrapped as an `Observable<RequestEvent>` |
| `src/server/core/bootstrap.ts` | Wires server + global middleware + router |
| `src/server/core/middleware.ts` | `logger()`, `requestId()`, `cors()` — `Middleware` operators and Effect wrappers |
| `src/server/core/router.ts` | Pattern-matching `createRouter`; `get/post/put/del/group/handle` helpers |
| `src/server/core/app.ts` | `createApp()` — injectable services, lifecycle hooks, `/health` + `/ready`, `cors?` option |
| `src/server/core/validator.ts` | `validateBody / validateParams / validateQuery` — Zod narrowing operators |
| `src/server/core/errors.ts` | `HttpError` hierarchy; `errorResponse()` maps any thrown error to a response |
| `src/server/core/response.ts` | `json / created / noContent / redirect` helpers |
| `src/server/core/testing.ts` | `runEffect / runRequest` (in-memory) and `createHttpTestClient` (live HTTP) |
| `src/server/todos/` | Concrete CRUD: store (BehaviorSubject), validator (Zod schemas), effects |

Effects retrieve their `TodoStore` from `req.context.services`, so the store is injectable and unit-testable without HTTP.

`cors()` returns an Effect wrapper `(effect: Effect) => Effect`. Pass it via `AppOptions.cors` — it intercepts `OPTIONS` preflight (returns 204 immediately) and injects CORS headers on all other responses:

```typescript
createApp(routes, {
	middlewares: [requestId(), logger()],
	cors: cors({ origins: ['http://localhost:5173'], credentials: true }),
});
```

`createApp` returns an `App` object with a `router: Effect` field — the fully-wired router (cors-wrapped if configured). Use it directly in tests without starting an HTTP server:

```typescript
const app = createApp(routes, { cors: cors() });
const res = await firstValueFrom(app.router(of(createTestRequest({ method: 'OPTIONS', url: '/todos' }))));
expect(res.status).toBe(204);
```

`requireAuth(verify, options?)` protects the app with a bring-your-own verifier. It reads `Authorization: Bearer <token>`, calls `verify`, and stores the result at `req.requestContext.state.user`. Returns 401 directly on missing/invalid tokens. `/health` and `/ready` are excluded by default:

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

### Shared route contracts (`src/shared/routes.ts`)

The single source of truth for every endpoint. One `RouteContract` declaration covers method, path template, body type, query type, and response type.

```typescript
// Derive types from the contract
type TodoParams  = RouteParams<typeof routes.todos.update.path>; // { id: string }
type CreateBody  = RouteBody<typeof routes.todos.create>;        // CreateTodoBody
type CreateResult = RouteResponse<typeof routes.todos.create>;   // Todo

// Build type-safe URLs
apiPath(routes.todos.update.path, { id: '42' }); // /api/todos/42
```

Adding a new endpoint: add one entry to `routes` in `src/shared/routes.ts`, add one `handle(contract, effect)` call in the server router, and the typed client is generated automatically.

### Client (`src/client/`)

| File | Responsibility |
|---|---|
| `src/client/h.ts` | Custom JSX factory (`h`) — no React |
| `src/client/todo.state.ts` | MVU state: `Subject` → `scan(reducer)` → `shareReplay(1)` |
| `src/client/todo.service.ts` | Typed client wrappers via `createClient` |
| `src/client/api.ts` | `createClient(routes)` — generates typed Observable methods from the contract tree |
| `src/client/main.tsx` | Entry: wires DOM events to `dispatch`, subscribes `state$` to re-render |

The client MVU pattern:

```typescript
export const action$ = new Subject<Action>();
export const state$  = action$.pipe(scan(reducer, initialState), startWith(initialState), shareReplay(1));
export const dispatch = (action: Action): void => action$.next(action);
```

### Generated typed client

```typescript
const api = createClient(routes);
api.todos.list({});                            // Observable<Todo[]>  (query-only route — pass {} or { completed: 'true' })
api.todos.create({ title: 'Ship it' });        // Observable<Todo>
api.todos.update({ id: '42' }, { completed: true });
api.todos.remove({ id: '42' });                // Observable<void>
```

`createClient` walks the contract tree: leaf nodes that match the `AnyRoute` shape are converted to functions; branches become nested objects. Argument order: `(params, body)` or `(query)` — only the slots present in the contract appear, in the order params → query/body.

### JSX configuration

TSX uses a custom factory — **not React**. `jsxFactory: 'h'`, `jsxFragmentFactory: 'null'`. Import `h` explicitly in any `.tsx` file.

## Testing patterns

**Unit-test an effect in-memory** (no HTTP):

```typescript
import { runRequest, createTestRequest } from '../core/testing';

const res = await runRequest(todoRoutes, createTestRequest({
  method: 'POST',
  url: '/todos',
  body: { title: 'Test' },
  context: createTestContext({ todoStore }),
}));
```

**Integration-test against a live server**:

```typescript
const client = createHttpTestClient('http://localhost:3000');
const res = await client.post('/todos', { title: 'Test' });
```
