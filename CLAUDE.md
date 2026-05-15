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
| `src/server/core/router.ts` | Pattern-matching `createRouter`; `get/post/put/del/group/handle` helpers |
| `src/server/core/app.ts` | `createApp()` — injectable services, lifecycle hooks, `/health` + `/ready` |
| `src/server/core/validator.ts` | `validateBody / validateParams / validateQuery` — Zod narrowing operators |
| `src/server/core/errors.ts` | `HttpError` hierarchy; `errorResponse()` maps any thrown error to a response |
| `src/server/core/response.ts` | `json / created / noContent / redirect` helpers |
| `src/server/core/testing.ts` | `runEffect / runRequest` (in-memory) and `createHttpTestClient` (live HTTP) |
| `src/server/todos/` | Concrete CRUD: store (BehaviorSubject), validator (Zod schemas), effects |

Effects retrieve their `TodoStore` from `req.context.services`, so the store is injectable and unit-testable without HTTP.

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
| `src/client/todo.service.ts` | `fromFetch` wrappers (raw, typed by route) |
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
api.todos.list();                              // Observable<Todo[]>
api.todos.create({ title: 'Ship it' });        // Observable<Todo>
api.todos.update({ id: '42' }, { completed: true });
```

`createClient` walks the contract tree: leaf nodes that match the `AnyRoute` shape are converted to functions; branches become nested objects. Argument order: `(params?, query?, body?)` — slots are omitted when not present in the contract.

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
