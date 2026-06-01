# Phase 1 App Skeleton Design

## Status

Approved for planning on 2026-06-01.

## Goal

Create the first runnable MurderBoard application skeleton as a local-first web app. The skeleton should establish the project structure, routing, layout, storage boundary, IndexedDB initialization, and test tooling needed for future feature work without implementing full business workflows yet.

## Decisions

- Use TypeScript, React, and Vite.
- Use npm as the package manager.
- Use React Router for client-side navigation.
- Use IndexedDB for local-first persistence.
- Keep IndexedDB access behind repository interfaces.
- Include basic layout, navigation, and placeholder pages for the documented product areas.
- Use Vitest and React Testing Library for the initial test harness.
- Do not add end-to-end testing in phase 1.

## Architecture

The app is a single-page React application with a clear separation between UI, feature modules, domain types, and persistence.

```text
App Shell
  -> Feature Pages
  -> Domain Types
  -> Repository Interfaces
  -> IndexedDB Adapter
```

The app shell owns application startup, routing, shared layout, navigation, global error handling, and top-level loading or failure states. Feature pages render placeholder screens for the major MurderBoard areas while future business workflows are still being designed.

The domain layer defines TypeScript types derived from the existing product and data-model documentation. The storage layer defines repository interfaces consumed by features and an IndexedDB adapter that implements those interfaces. This keeps future UI work independent from the persistence mechanism.

## Components and File Boundaries

Use the following source layout:

```text
src/
  app/
    App.tsx
    routes.tsx
    layout/
  domain/
    types/
  features/
    cases/
    entities/
    timeline/
    evidence/
    notes/
    trash/
    archive/
  shared/
    ui/
    state/
  storage/
    repositories/
    indexeddb/
```

`src/app` contains the application entry structure, routes, and layout. `src/features` contains route-level feature modules and placeholder pages. `src/domain` contains core MurderBoard types such as case boards, characters, locations, events, evidence, notes, trash metadata, and archive metadata. `src/storage` contains repository contracts and the IndexedDB implementation. `src/shared` contains simple reusable UI and state components such as empty, loading, and error states.

Each feature module should be understandable without reading storage internals. Each repository implementation should be replaceable without changing page components.

## Data Flow

React Router selects the route and renders the matching feature page. Feature pages call feature-level hooks or loaders, which depend on repository interfaces rather than IndexedDB directly. Repository methods return domain objects, empty results, or explicit errors. The IndexedDB adapter is the only code that opens databases, manages object stores, or performs browser storage operations.

Phase 1 should not introduce a global state management library. React state and small async hooks are sufficient until real workflows create a need for shared caching or cross-page synchronization.

## Error Handling

IndexedDB initialization, version upgrades, and read/write operations should surface explicit errors to the calling layer. The UI should show understandable error states instead of silently failing or rendering a blank screen.

The app shell should include a global error boundary. Route-level placeholder pages should use the same loading, empty, and error state pattern that future feature pages can reuse.

## Testing

Set up Vitest and React Testing Library. Initial tests should cover:

- The app renders successfully.
- Core routes render the expected placeholder pages.
- The shared layout and navigation render.
- The IndexedDB adapter can initialize.
- Storage initialization failures can be surfaced as errors.

End-to-end tests are intentionally out of scope for phase 1. They should be added when there are meaningful user workflows to exercise.

## Out of Scope

- Full case-board editing workflows.
- Real timeline creation and filtering.
- Trash restore behavior beyond placeholder routes and type boundaries.
- Archive restore behavior beyond placeholder routes and type boundaries.
- Import, export, authentication, collaboration, or sync.
- Pixel-perfect visual design.

## Success Criteria

- A developer can install dependencies, run the app locally, and see the MurderBoard shell.
- The main documented product areas have navigable placeholder pages.
- Domain and storage boundaries are present before feature implementation begins.
- IndexedDB can be initialized through a storage adapter.
- Unit and component tests can run through npm scripts.
- The skeleton is small enough for future feature specs to build on without major restructuring.
