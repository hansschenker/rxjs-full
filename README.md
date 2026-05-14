# rxjs-stack

[![CI](https://github.com/hansschenker/rxjs-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/hansschenker/rxjs-stack/actions/workflows/ci.yml)

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
bootstrap(3000, router, logger(), cors());
```

### 3. Observable HTTP server

```typescript
const createServer = (port: number): Observable<RequestEvent>
```

The Node.js HTTP server wrapped as an Observable source. Requests are events in a stream; teardown closes the server.

### 4. Type-safe request validation

```typescript
const validate = <T>(codec: t.Type<T>): OperatorFunction<HttpRequest, HttpRequest & { body: T }>
```

Powered by [io-ts](https://github.com/gcanti/io-ts). After `validate(MyCodec)`, `req.body` is typed as `T` — no casts needed downstream. Invalid requests throw a `ValidationError` that the router catches and maps to 422.

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
│   └── types.ts          # Todo, CreateTodoBody, UpdateTodoBody — shared between client and server
│
├── server/
│   ├── core/
│   │   ├── types.ts      # Effect, Middleware, HttpRequest, HttpResponse
│   │   ├── http.ts       # createServer — Node HTTP as Observable
│   │   ├── middleware.ts  # logger() middleware
│   │   ├── validator.ts  # validate(codec) — io-ts narrowing operator
│   │   ├── router.ts     # createRouter — pattern matching Effect
│   │   └── bootstrap.ts  # wires server + middleware + router
│   ├── todos/
│   │   ├── todo.store.ts     # in-memory BehaviorSubject store
│   │   ├── todo.validator.ts # io-ts codecs for todo bodies
│   │   └── todo.effect.ts    # getAll$, create$, update$, delete$
│   └── main.ts           # entry point
│
└── client/
    ├── h.ts                      # custom TSX factory (no React)
    ├── todo.state.ts             # MVU state: Subject + scan + shareReplay
    ├── todo.service.ts           # fromFetch wrappers for the API
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
| Validation | io-ts + fp-ts |
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
npm test          # run all 78 tests
npm run typecheck # TypeScript strict check
```

---

## Why no framework?

Marble.js proved the patterns work. But as of 2025 the project is effectively unmaintained — inactive GitHub, Gitbook docs with a v3→v4 gap, and the original demo no longer runs. The five ideas above are sound; the wrapper around them is not necessary.

rxjs-stack keeps the ideas and drops the dependency. The result is ~400 lines of core code that are easy to read, test, and extend.

---

## Contributors

- **Hans Schenker** — architecture direction, design decisions, requirements
- **Claude (Anthropic)** — primary implementation contributor; wrote the server core, client MVU layer, TSX factory, all 78 tests, and this README in a single pair-programming session

> This project is an example of what agentic AI-assisted development looks like in practice: the human steers, the AI executes — minimal back-and-forth, maximum output.
