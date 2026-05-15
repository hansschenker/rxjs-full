# Missing v0.2 Features

The backend-focused `v0.2` roadmap is mostly implemented. The remaining work before calling `v0.2` feature complete is concentrated in a few areas.

## Completed in the current session

### 1. Real per-request context

Implemented:

- request-scoped context on every request
- mutable request-local state separate from app-level state
- built-in request ID middleware example

### 2. Typed query support in shared route contracts

Implemented:

- query type parameter on `RouteContract`
- `RouteQuery<TRoute>`
- generated client signatures with typed query arguments
- query-string generation in `apiPath()`
- shared query validation demonstrated by `GET /todos?completed=true`

### 3. Contract-bound server handlers with response enforcement

Implemented:

- `handle(route, effect)` for server registration
- method and path derivation from shared contracts
- `ContractEffect<TRoute>` request-shape enforcement for params, query, and body

## Remaining before tagging v0.2

## Worth adding before tagging v0.2

### 4. Dedicated v0.2 usage documentation

Add a short guide that shows one complete flow:

1. define the shared route contract
2. implement the server handler
3. register the handler with the app
4. call the generated client method

This would make the framework API understandable as a product, not only as source code.

### 5. Canonical request-context example

Add one built-in or documented example such as request ID middleware to demonstrate the intended per-request context model.

### 6. Stronger response contract support

Current contracts describe response body types, but not richer response semantics such as:

- expected status codes
- typed error payloads
- alternate response shapes

This is not a strict blocker for `v0.2`, but it would make the contract layer more durable.

### 7. Public export surface and repo hygiene

Helpful cleanup before presenting `v0.2` as a milestone:

- add a public barrel such as `src/server/core/index.ts`
- remove or stop tracking local `node_modules` noise
- keep generated/local workspace artifacts out of Git status

## Recommended completion order

1. Usage documentation
2. Richer response contracts
3. Public export cleanup and repo hygiene
