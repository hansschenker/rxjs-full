# Changelog

All notable changes to rxjs-stack are documented here.

---

## [Unreleased]

---

## [0.4.0] — 2026-05-15

### Added

**Server-Sent Events (v0.4)**
- `SseEvent` interface — `{ event?: string; data: unknown; id?: string }` — typed SSE event shape
- `stream?` field on `HttpResponse` — presence signals SSE mode; `body` is ignored when set
- `stream$(source$, eventType?)` response helper — wraps any `Observable<T>` as an SSE response with correct headers
- `formatSseChunk(event: SseEvent): string` — serialises to SSE wire format (`id:`/`event:`/`data:` fields, double-newline terminator)
- `applySse(stream, nodeReq, nodeRes): void` — subscribes to the stream, writes chunks, tears down on client disconnect via `req.on('close', ...)`
- SSE branch in `respond()` — detects `stream` and enters SSE mode; writes `text/event-stream` headers and delegates to `applySse`
- `TodoStore.todos$: Observable<Todo[]>` — internal `BehaviorSubject` exposed as a public Observable; emits on every `setTodos` call
- `GET /todos/stream` demo endpoint — pushes the live todo list as SSE events named `'todos'`
- `fromEventSource<T>(url, eventType): Observable<T>` — cold Observable wrapping the browser `EventSource` API; teardown calls `es.close()`; `onerror` closes the connection and errors the Observable; `JSON.parse` failures route to `observer.error`
- Test suite grows from 159 (v0.3) to 180 tests across 19 files

---

## [0.3.0] — 2026-05-15

### Added

**Auth middleware (v0.3)**
- `requireAuth<TClaims>(verify, options?)` — app-wide Bearer token auth Effect wrapper with bring-your-own verifier
- `AuthOptions.exclude` — path list that bypasses auth; defaults to `['/health', '/ready']`; query strings stripped before matching
- `AppOptions.auth?` in `createApp` — wires `requireAuth` inside `cors` so OPTIONS preflight is never blocked by auth
- Claims stored at `req.requestContext.state.user` as `TClaims` — accessible in any downstream route effect
- 15 new tests: `requireAuth()` unit suite (8), `createApp` auth integration (4), living-doc tests in `claude-md.test.ts` (3)
- Test suite grows from 144 (v0.2) to 159 tests across 17 files

---

## [0.2.0] — 2026-05-14

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
- `errors.test.ts` — 17 tests covering `HttpError` hierarchy and `errorResponse()`
- Test suite grows from 78 (v1.0.0) to 144 tests across 17 files

### Fixed
- `defineRoute` now correctly propagates query-parameter presence at runtime, enabling `createClient` to build query strings from the contract

---

## [1.0.0] — 2026-05-14

### Added

**Core implementation**
- 5 Marble.js-inspired patterns in pure RxJS — `Effect`, `Middleware`, `createServer`, `validate`, `createRouter`
- Observable HTTP server wrapping Node.js `http` as an `Observable<RequestEvent>`
- `validate(codec)` — io-ts operator that narrows `req.body` to `T` with no downstream casts
- `createRouter(routes)` — router is itself an `Effect`, catches `ValidationError` → 422 and unknown errors → 500
- `logger()` middleware as `OperatorFunction<HttpRequest, HttpRequest>`, composable with `pipe()`
- `bootstrap(port, router, ...middlewares)` — wires Observable server to router and middleware chain
- Todos CRUD API — `getAll$`, `create$`, `update$`, `delete$` using io-ts validated Effects
- In-memory BehaviorSubject store for todos
- Shared TypeScript types between server and client (`Todo`, `CreateTodoBody`, `UpdateTodoBody`)

**Client**
- Custom `h()` TSX factory — no React, no virtual DOM
- MVU state layer — `Subject<Action>` + `scan(reducer)` + `startWith` + `shareReplay(1)`
- `fromFetch` service layer for all CRUD operations
- `TodoItem` component using JSX with the custom factory
- Form submission with `fromEvent` + `exhaustMap` — prevents double-submit

**Tests (78 total)**
- Server: validator (8), router (10), middleware (3), todos effects (17)
- Client: `h()` factory (16), state/reducer (12), service/fetch (5), `TodoItem` (8)

**GitHub repository setup**
- MIT license
- `.gitignore`
- README with architecture docs, code samples, project structure, getting started guide
- 9 badges — CI, MIT, TypeScript, RxJS 7, Vitest, Vite, Node.js 22, io-ts, Security Policy
- Contributors section with GitHub avatars
- CI workflow (GitHub Actions) — typecheck + tests on every push and PR
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`
- Issue templates (bug report, feature request) and PR template
- Dependabot config — weekly updates for npm and GitHub Actions
- 100% GitHub community health score

### Fixed
- `fp-ts/Either` import path changed to `fp-ts/lib/Either` for tsx ESM compatibility

---

## Format

This changelog follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
