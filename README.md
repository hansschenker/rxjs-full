# rxjs-stack

[![CI](https://github.com/hansschenker/rxjs-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/hansschenker/rxjs-stack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/hansschenker/rxjs-stack/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org/)
[![RxJS](https://img.shields.io/badge/RxJS-7-pink?logo=reactivex)](https://rxjs.dev)
[![Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest)](https://vitest.dev)
[![Vite](https://img.shields.io/badge/bundled%20with-Vite-646CFF?logo=vite)](https://vite.dev)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs)](https://nodejs.org)
[![Zod](https://img.shields.io/badge/validation-Zod-blue)](https://zod.dev)
[![Security Policy](https://img.shields.io/badge/security-policy-green?logo=github)](https://github.com/hansschenker/rxjs-stack/blob/main/SECURITY.md)
[![Built with Claude Code](https://img.shields.io/badge/built%20with-Claude%20Code-blueviolet?logo=anthropic)](https://claude.ai/code)

A full-stack TypeScript application built entirely with RxJS — no framework on the server, no framework on the client. Everything is Observables, operators, and pure functions.

This project distils five patterns from [Marble.js](https://docs.marblejs.com/) and reimplements them in plain RxJS, making the ideas available without the framework dependency.

---

## The five core patterns

### 1. Effect — the universal function type

```typescript
type Effect = (req$: Observable<HttpRequest>) => Observable<HttpResponse>;
```

A route handler, a middleware, a router — all the same shape. An Effect is a Kleisli arrow in the Observable monad: a function that takes a stream and returns a stream.

### 2. Middleware as OperatorFunction

```typescript
type Middleware = OperatorFunction<HttpRequest, HttpRequest>;
```

Middleware is just an RxJS operator. Compose it with `pipe()`, exactly like any other operator.

```typescript
const app = createApp(routes, {
    middlewares: [requestId(), logger()],
    cors: cors(),
});
```

### 3. Observable HTTP server

```typescript
const createServer = (port: number): Observable<RequestEvent>
```

The Node.js HTTP server wrapped as an Observable source. Requests are events in a stream; teardown closes the server.

### 4. Type-safe request validation

```typescript
const validateBody = <T>(schema: ZodType<T>): OperatorFunction<HttpRequest, HttpRequest & { body: T }>
```

Powered by [Zod](https://zod.dev). After `validateBody(MySchema)`, `req.body` is typed as `T` — no casts needed downstream. The same model now covers body, params, and query validation. Invalid requests throw a structured `ValidationError` that the router maps to 422.

### 5. Router as Effect

```typescript
const createRouter = (routes: Route[]): Effect
```

The router is itself an Effect. It matches by method and path, extracts params, and delegates to the matching route's Effect. Errors are caught per-route and mapped to status codes.

---

## Project structure

```
src/
├── shared/
│   ├── types.ts          # Todo, CreateTodoBody, UpdateTodoBody — shared between client and server
│   └── routes.ts         # RouteContract definitions, RouteParams/RouteBody/RouteResponse utilities, apiPath
│
├── server/
│   ├── core/
│   │   ├── types.ts      # Effect, Middleware, HttpRequest, HttpResponse
│   │   ├── http.ts       # createServer — Node HTTP as Observable
│   │   ├── middleware.ts  # logger(), requestId(), cors() middleware
│   │   ├── app.ts        # createApp() — context, lifecycle hooks, health routes
│   │   ├── errors.ts     # HttpError hierarchy + centralized mapping
│   │   ├── response.ts   # json(), created(), noContent(), redirect(), cookies
│   │   ├── testing.ts    # in-memory request runner + HTTP test client
│   │   ├── validator.ts  # Zod narrowing operators for body / params / query
│   │   ├── router.ts     # createRouter — pattern matching Effect
│   │   └── bootstrap.ts  # wires server + middleware + router
│   ├── todos/
│   │   ├── todo.store.ts     # in-memory BehaviorSubject store
│   │   ├── todo.validator.ts # Zod schemas for todo bodies and params
│   │   └── todo.effect.ts    # getAll$, create$, update$, delete$
│   └── main.ts           # entry point
│
└── client/
    ├── h.ts                      # custom TSX factory (no React)
    ├── todo.state.ts             # MVU state: Subject + scan + shareReplay
    ├── todo.service.ts           # typed client wrappers via createClient
    ├── api.ts                    # createClient — typed Observable client from route contracts
    ├── components/
    │   └── todo-item.tsx         # TodoItem component
    └── main.tsx                  # app entry: fromEvent + exhaustMap form handler
```

---

## Client architecture

The client follows the MVU (Model–View–Update) pattern — the same architecture as Elm, without Elm.

```typescript
// State
const action$ = new Subject<Action>();
const state$  = action$.pipe(scan(reducer, initialState), startWith(initialState), shareReplay(1));
const dispatch = (action: Action) => action$.next(action);

// Update — pure reducer, one case per action
const reducer = (state: State, action: Action): State => { ... };

// View — re-renders on every state emission
state$.subscribe(({ todos, error }) => { /* update DOM */ });
```

Form submission uses `exhaustMap` to prevent double-submit:

```typescript
fromEvent(form, 'submit').pipe(
    tap(e => e.preventDefault()),
    map(() => titleInput.value.trim()),
    filter(title => title.length > 0),
    exhaustMap(title => create$({ title }).pipe(catchError(() => EMPTY))),
).subscribe();
```

---

## Tech stack

| Concern | Tool |
|---|---|
| Language | TypeScript (strict) |
| Runtime | Node.js (server), browser (client) |
| Reactive layer | RxJS 7 |
| Validation | Zod |
| Bundler | Vite |
| Testing | Vitest + jsdom |
| Server transport | Node `http` (no Express, no Fastify) |

---

## Getting started

```bash
npm install

# terminal 1 — API server (port 3000, tsx watch)
npm run dev:server

# terminal 2 — client dev server (Vite)
npm run dev:client
```

Open the URL Vite prints (typically `http://localhost:5173`).

```bash
npm test          # run all tests
npm run typecheck # TypeScript strict check
```

---

## v0.4 framework surface

### Server-Sent Events

A route handler returns `stream$(source$, eventType)` instead of `json(data)`. The server keeps the connection open and pushes typed SSE events as the source Observable emits. The client-side `fromEventSource<T>` helper wraps the browser `EventSource` API as an Observable, closing the reactive loop end-to-end.

#### Server

```typescript
// Route effect — return stream$() instead of json()
todoStream$: req$ => req$.pipe(
    map(req => {
        const store = req.context.services.todoStore as TodoStore;
        return stream$(store.todos$, 'todos');
    }),
)
```

`stream$(source$, 'todos')` returns an `HttpResponse` with `stream` set. When `respond()` detects it, it writes SSE headers and subscribes to the Observable, serialising each emission as:

```
event: todos
data: [...]

```

Client disconnect (via `req.on('close', ...)`) unsubscribes the source Observable automatically.

#### `TodoStore.todos$`

`todos$: Observable<Todo[]>` is now part of the `TodoStore` interface — the internal `BehaviorSubject` exposed as a read-only Observable. New subscribers receive the current list immediately; every `setTodos` call pushes an update.

```typescript
export interface TodoStore {
    getTodos: () => Todo[];
    setTodos: (todos: Todo[]) => void;
    reset: () => void;
    todos$: Observable<Todo[]>;   // new
}
```

#### Client

```typescript
import { fromEventSource } from './sse';

fromEventSource<Todo[]>('/api/todos/stream', 'todos')
    .subscribe(todos => render(todos));
```

`fromEventSource` is a cold Observable — it creates an `EventSource` on subscribe and calls `es.close()` on unsubscribe. Parse errors and connection errors route to `observer.error`.

---

## v0.3 framework surface

### Auth middleware

`requireAuth<TClaims>(verify, options?)` protects the entire app with a bring-your-own verifier. It reads `Authorization: Bearer <token>`, calls `verify`, and stores the result at `req.requestContext.state.user`. Returns 401 directly on missing or invalid tokens — no throw needed in route code. `/health` and `/ready` are excluded by default:

```typescript
createApp(routes, {
    cors: cors(),
    auth: requireAuth(
        async token => {
            const payload = await myJwtVerify(token);
            return payload;  // stored as req.requestContext.state.user
        },
        { exclude: ['/login', '/health', '/ready'] },
    ),
});
```

`cors` stays outermost so `OPTIONS` preflight is short-circuited before auth ever runs.

---

## v0.2 framework surface

The backend core includes the first application-level framework features:

- `createApp()` with injectable services, per-app context, lifecycle hooks, and built-in `/health` plus `/ready`
- route helpers such as `get()`, `post()`, `put()`, `del()`, and nested `group()` definitions
- route-level middleware composition
- centralized `HttpError` classes and error-to-response mapping
- response helpers for JSON, creation, redirects, headers, and cookies
- Zod validation for body, params, and query streams
- testing helpers for in-memory route execution and HTTP test clients

The client and server share route contracts from `src/shared/routes.ts`. Path templates live in one place, route parameter types are inferred from those templates, and the same contract owns request-body and response-body types:

```typescript
type TodoParams = RouteParams<typeof routes.todos.update.path>; // { id: string }
type CreateBody = RouteBody<typeof routes.todos.create>;         // CreateTodoBody
type CreateResult = RouteResponse<typeof routes.todos.create>;   // Todo

apiPath(routes.todos.update.path, { id: '42' }); // /api/todos/42
```

The client `createClient(routes)` helper derives a typed client tree directly from the shared contract map:

```typescript
const api = createClient(routes);

api.todos.list({});                       // Observable<Todo[]>
api.todos.create({ title: 'Ship it' });   // Observable<Todo>
api.todos.update({ id: '42' }, { completed: true });
```

A new endpoint needs one shared route declaration and one server handler; client transport wrappers are generated from the contract tree instead of handwritten.

## Why no framework?

Marble.js proved the patterns work. But as of 2025 the project is effectively unmaintained — inactive GitHub, Gitbook docs with a v3→v4 gap, and the original demo no longer runs. The five ideas above are sound; the wrapper around them is not necessary.

rxjs-stack keeps the ideas and drops the dependency. The result is ~400 lines of core code that are easy to read, test, and extend.

---

## How this was built — agentic workflow

This project was built in a single pair-programming session between a human architect and [Claude Code](https://claude.ai/code) (Anthropic's AI coding agent).

**The workflow:**

1. **Human steers** — architecture direction, naming decisions, scope, requirements
2. **Claude executes** — implementation, tests, fixes, GitHub setup, documentation
3. **Human verifies** — runs the app, confirms it works end-to-end, approves each step

Claude asked only a handful of questions during the entire session — naming (`rxjs-stack` vs `rxjs-full`), which license to use, and a couple of architectural choices. Everything else was derived from context and executed without interruption.

**What Claude built autonomously:**
- All 5 server core modules (~400 lines)
- Todos CRUD API with Zod validation
- Custom TSX factory, MVU state layer, service layer, TodoItem component
- 78 tests across 8 files (server + client) at v1.0.0 — now 180 tests across 19 files after v0.4
- README, CHANGELOG, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue/PR templates
- GitHub Actions CI, Dependabot config, all repo settings, badges, release

**Why this matters:**

Agentic development changes what a single developer can ship in an afternoon. The human's job shifts from writing code to making decisions — architecture, scope, trade-offs. The AI handles the implementation detail. The result is a fully tested, documented, and published open source project built faster than most developers could scaffold the boilerplate alone.

---

## Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/hansschenker">
        <img src="https://github.com/hansschenker.png" width="80" alt="Hans Schenker" /><br />
        <b>Hans Schenker</b>
      </a><br />
      Architecture direction, design decisions, requirements
    </td>
    <td align="center">
      <a href="https://claude.ai">
        <img src="https://github.com/anthropics.png" width="80" alt="Claude (Anthropic)" /><br />
        <b>Claude (Anthropic)</b>
      </a><br />
      Primary implementation contributor; server core, client MVU layer, TSX factory, tests, and this README
    </td>
  </tr>
</table>

> This project is an example of what agentic AI-assisted development looks like in practice: the human steers, the AI executes — minimal back-and-forth, maximum output.
