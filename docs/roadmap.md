# Roadmap

## v0.2 - Turn the prototype into a usable backend framework

Goal: make the server side pleasant for small real applications, not just demos.

1. Application context / dependency injection
   - `AppContext`
   - injectable services
   - per-request context
   - test-friendly factories instead of module-level singletons

2. Better routing
   - route groups
   - route-level middleware
   - nested prefixes
   - typed params and query helpers
   - helpers for common HTTP methods

3. Unified error system
   - framework error classes such as `BadRequest`, `NotFound`, and `Unauthorized`
   - centralized error-to-response mapping
   - structured validation error payloads
   - no ad hoc `{ error: string }` responses scattered through effects

4. Response helpers
   - `json()`
   - `noContent()`
   - `created()`
   - `redirect()`
   - header and cookie helpers

5. Validation cleanup
   - decide whether the framework standard is Zod, io-ts, or an adapter layer
   - request body, params, and query validation
   - typed schemas flowing into handlers

6. Lifecycle hooks
   - startup
   - shutdown
   - resource cleanup
   - readiness and health endpoints

7. Testing utilities
   - in-memory app runner
   - HTTP test client
   - effect test helpers
   - fixture helpers for context and services

Exit criterion for v0.2:

A developer should be able to build a small CRUD API with auth, validation, database access, and tests without inventing project structure themselves.

## v0.3 - Make it a credible full-stack framework

Goal: define the browser story and connect it cleanly to the backend model.

1. Client router
   - nested routes
   - route params
   - guards
   - lazy loading
   - link and navigation helpers

2. Component/runtime improvements
   - component lifecycle
   - local reactive state
   - cleanup semantics
   - memoized rendering or targeted DOM updates
   - better TSX ergonomics

3. Data fetching model
   - typed API client generation or shared endpoint contracts
   - loading, error, and success helpers
   - cancellation
   - invalidation and refresh patterns

4. Form handling
   - reactive forms
   - validation integration
   - pending, dirty, and touched state
   - optimistic submit patterns

5. Full-stack contract layer
   - define routes once
   - derive server validation and client callers
   - shared request and response types
   - avoid manually duplicating paths

6. SSR decision
   - either support SSR and hydration
   - or explicitly stay client-rendered and optimize that path
   - the framework needs a clear stance

7. Real-time primitives
   - SSE
   - WebSockets
   - reconnection helpers
   - server-to-client stream contracts
   - make RxJS a visible advantage

8. Developer experience
   - starter template
   - CLI scaffolding
   - file conventions
   - hot reload story
   - examples beyond todos

Exit criterion for v0.3:

A developer should be able to build a small full-stack product with navigation, forms, typed APIs, and real-time updates using only framework-native patterns.

## v0.4 - Make it feel serious

Goal: remove the gaps that stop teams from trusting it.

1. Authentication package
   - sessions
   - JWT
   - password auth examples
   - role and policy helpers

2. Security package
   - CORS
   - CSRF guidance and helpers
   - rate limiting
   - secure headers
   - cookie defaults

3. Observability
   - structured logger
   - request IDs
   - metrics hooks
   - tracing hooks
   - timing middleware

4. Persistence integrations
   - official examples for PostgreSQL
   - repository patterns
   - transaction helpers
   - migrations guidance
   - adapters for Prisma, Drizzle, or Kysely rather than a custom ORM

5. Streaming and background work
   - file and response streaming
   - queues
   - scheduled jobs
   - event bus patterns

6. Performance work
   - benchmarks
   - memory profiling
   - backpressure guidance
   - operator conventions for request lifetimes

7. Documentation
   - conceptual guide
   - cookbook
   - API reference
   - migration notes
   - architecture examples

Exit criterion for v0.4:

A technically skeptical team should be able to evaluate it without immediately finding missing fundamentals.

## v1.0 - Production-ready framework

Goal: stable public API and a coherent ecosystem.

1. Stable core APIs
   - documented extension points
   - versioning policy
   - deprecation policy

2. Plugin system
   - auth
   - database
   - cache
   - websocket
   - monitoring
   - deployment integrations

3. Official tooling
   - CLI
   - code generators
   - test presets
   - production build pipeline
   - deployment templates

4. Ecosystem packages
   - `@rxjs-stack/core`
   - `@rxjs-stack/router`
   - `@rxjs-stack/http`
   - `@rxjs-stack/client`
   - `@rxjs-stack/forms`
   - `@rxjs-stack/realtime`
   - `@rxjs-stack/testing`

5. Reference applications
   - CRUD SaaS app
   - real-time dashboard
   - auth-enabled app
   - SSR or SPA reference depending on framework direction

6. Governance and maintenance
   - contribution model
   - release cadence
   - issue triage
   - compatibility guarantees

Exit criterion for v1.0:

A new developer can start a project, follow the documented path, and ship a real application without the framework feeling incomplete.

## Recommended order of attack

1. `AppContext` and dependency injection
2. Unified errors
3. Richer router
4. Validation standardization
5. Response helpers
6. Testing harness
7. Typed endpoint contracts
8. Client router and data layer
9. Real-time primitives

That order matters because the backend composition model will shape almost every later API.

## Key product decision

Before going too far, decide what this framework wants to be:

1. Minimal reactive core
   - a small, elegant framework for people who already like composing systems themselves

2. Batteries-included full-stack framework
   - a more opinionated alternative to Next or Nest-style stacks, but with RxJS as the central model

This roadmap assumes the second path. If the first path is preferred, many items should become adapters and examples rather than built-in features.
