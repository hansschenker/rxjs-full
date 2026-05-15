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
