# Phase 1 App Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable local-first MurderBoard web application skeleton with React, Vite, routing, domain boundaries, IndexedDB initialization, and tests.

**Architecture:** The app is a Vite-powered React single-page application. UI code lives behind an app shell and route-level feature modules, domain types are isolated from React, and browser persistence is accessed only through storage interfaces and an IndexedDB adapter.

**Tech Stack:** TypeScript, React, React Router, Vite, IndexedDB, Vitest, React Testing Library, fake-indexeddb, npm.

---

## Scope Check

The approved spec covers one subsystem: the phase 1 application skeleton. It does not require decomposing into separate implementation plans because each task below produces part of the same runnable app foundation.

## File Structure

Create or modify these files:

```text
package.json                         npm scripts and dependencies
package-lock.json                    locked npm dependency graph
index.html                           Vite HTML entry
tsconfig.json                        root TypeScript project references
tsconfig.app.json                    app TypeScript options
tsconfig.node.json                   Vite config TypeScript options
vite.config.ts                       Vite and Vitest configuration
vitest.setup.ts                      test environment setup
README.md                            developer commands for running the app
src/main.tsx                         React browser entry
src/app/App.tsx                      top-level router provider and error boundary
src/app/App.test.tsx                 smoke test for the application shell
src/app/routes.tsx                   route definitions and browser router factory
src/app/routes.test.tsx              route rendering tests
src/app/styles.css                   basic application layout styles
src/app/layout/AppLayout.tsx         shared shell layout and navigation
src/app/layout/AppLayout.test.tsx    navigation rendering tests
src/app/layout/RouteError.tsx        route error renderer
src/domain/types.ts                  core MurderBoard domain types and constants
src/domain/types.test.ts             domain constant and guard tests
src/features/home/HomePage.tsx       home route page
src/features/cases/CasesPage.tsx     cases route page
src/features/entities/EntitiesPage.tsx entity route page
src/features/timeline/TimelinePage.tsx timeline route page
src/features/evidence/EvidencePage.tsx evidence route page
src/features/notes/NotesPage.tsx     notes route page
src/features/trash/TrashPage.tsx     trash route page
src/features/archive/ArchivePage.tsx archive route page
src/features/route-stub/RouteStubPage.tsx reusable route stub page
src/shared/state/EmptyState.tsx      reusable empty state
src/shared/state/ErrorBoundary.tsx   global React error boundary
src/shared/state/ErrorState.tsx      reusable error state
src/shared/state/LoadingState.tsx    reusable loading state
src/shared/state/index.ts            state component exports
src/shared/state/state-components.test.tsx state component tests
src/storage/repositories/case-board-repository.ts repository contracts
src/storage/repositories/index.ts    repository exports
src/storage/storage-error.ts         storage error types
src/storage/storage-error.test.ts    storage error tests
src/storage/indexeddb/object-stores.ts IndexedDB schema constants
src/storage/indexeddb/indexed-db-client.ts IndexedDB initialization adapter
src/storage/indexeddb/indexed-db-client.test.ts IndexedDB adapter tests
src/storage/indexeddb/index.ts       IndexedDB exports
```

---

### Task 1: Bootstrap React, Vite, TypeScript, and Vitest

**Files:**
- Create/modify: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.test.tsx`

- [ ] **Step 1: Install the project toolchain**

Run:

```powershell
cd C:\Users\Admin\MurderBoard
npm init -y
npm install react react-dom react-router-dom
npm install -D @vitejs/plugin-react @testing-library/jest-dom @testing-library/react @testing-library/user-event @types/react @types/react-dom fake-indexeddb jsdom typescript vite vitest
npm pkg set type=module
npm pkg set scripts.dev="vite --host 127.0.0.1"
npm pkg set scripts.build="tsc -b && vite build"
npm pkg set scripts.preview="vite preview --host 127.0.0.1"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.test:watch="vitest"
```

Expected: `package.json` and `package-lock.json` exist, and npm reports successful installs.

- [ ] **Step 2: Add TypeScript, Vite, and test configuration**

Create `tsconfig.json`:

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

Create `tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "vitest.setup.ts"]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
  },
});
```

Create `vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
```

Create `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MurderBoard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write the failing app smoke test**

Create `src/app/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the MurderBoard shell title', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /murderboard/i }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the smoke test and verify it fails**

Run:

```powershell
npm test -- src/app/App.test.tsx
```

Expected: FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 5: Add the minimal React entry and app component**

Create `src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main>
      <h1>MurderBoard</h1>
    </main>
  );
}
```

Create `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Run the smoke test and build**

Run:

```powershell
npm test -- src/app/App.test.tsx
npm run build
```

Expected: PASS for the test and a successful Vite production build.

- [ ] **Step 7: Commit the bootstrap**

Run:

```powershell
git add package.json package-lock.json index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.setup.ts src/main.tsx src/app/App.tsx src/app/App.test.tsx
git commit -m "Add React Vite app bootstrap" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Add Domain Types and Storage Contracts

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/types.test.ts`
- Create: `src/storage/repositories/case-board-repository.ts`
- Create: `src/storage/repositories/index.ts`
- Create: `src/storage/storage-error.ts`
- Create: `src/storage/storage-error.test.ts`

- [ ] **Step 1: Write failing domain tests**

Create `src/domain/types.test.ts`:

```ts
import { CORE_ENTITY_TYPES, isCoreEntityType } from './types';

describe('domain types', () => {
  it('lists the core entity types from the product model', () => {
    expect(CORE_ENTITY_TYPES).toEqual([
      'character',
      'location',
      'object',
      'organization',
      'concept',
    ]);
  });

  it('checks whether a value is a core entity type', () => {
    expect(isCoreEntityType('character')).toBe(true);
    expect(isCoreEntityType('scene')).toBe(false);
  });
});
```

- [ ] **Step 2: Run domain tests and verify they fail**

Run:

```powershell
npm test -- src/domain/types.test.ts
```

Expected: FAIL because `src/domain/types.ts` does not exist.

- [ ] **Step 3: Add core domain types**

Create `src/domain/types.ts`:

```ts
export type IsoDateString = string;

export const CORE_ENTITY_TYPES = [
  'character',
  'location',
  'object',
  'organization',
  'concept',
] as const;

export type CoreEntityType = (typeof CORE_ENTITY_TYPES)[number];

export type CaseBoardStatus = 'active' | 'archived';

export interface CaseBoard {
  id: string;
  title: string;
  description: string;
  status: CaseBoardStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  archivedAt: IsoDateString | null;
}

export interface BoardEntity {
  id: string;
  caseBoardId: string;
  type: CoreEntityType;
  name: string;
  summary: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface TimelineEvent {
  id: string;
  caseBoardId: string;
  title: string;
  occurredAt: IsoDateString | null;
  description: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface EvidenceItem {
  id: string;
  caseBoardId: string;
  title: string;
  source: string;
  notes: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Note {
  id: string;
  caseBoardId: string;
  title: string;
  body: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface TrashEntry {
  id: string;
  caseBoardId: string;
  itemType: string;
  itemId: string;
  deletedAt: IsoDateString;
}

export interface ArchiveEntry {
  id: string;
  caseBoardId: string;
  archivedAt: IsoDateString;
  restoredAt: IsoDateString | null;
}

export function isCoreEntityType(value: string): value is CoreEntityType {
  return CORE_ENTITY_TYPES.includes(value as CoreEntityType);
}
```

- [ ] **Step 4: Run domain tests and verify they pass**

Run:

```powershell
npm test -- src/domain/types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing storage error tests**

Create `src/storage/storage-error.test.ts`:

```ts
import { StorageInitializationError } from './storage-error';

describe('StorageInitializationError', () => {
  it('keeps the database name and cause', () => {
    const cause = new Error('open failed');
    const error = new StorageInitializationError('murderboard-test', cause);

    expect(error.name).toBe('StorageInitializationError');
    expect(error.databaseName).toBe('murderboard-test');
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('murderboard-test');
  });
});
```

- [ ] **Step 6: Run storage error tests and verify they fail**

Run:

```powershell
npm test -- src/storage/storage-error.test.ts
```

Expected: FAIL because `src/storage/storage-error.ts` does not exist.

- [ ] **Step 7: Add storage errors and repository contracts**

Create `src/storage/storage-error.ts`:

```ts
export class StorageInitializationError extends Error {
  constructor(
    public readonly databaseName: string,
    cause: unknown,
  ) {
    super(`Unable to initialize IndexedDB database "${databaseName}".`, {
      cause,
    });
    this.name = 'StorageInitializationError';
  }
}
```

Create `src/storage/repositories/case-board-repository.ts`:

```ts
import type { CaseBoard } from '../../domain/types';

export interface CaseBoardRepository {
  listCaseBoards(): Promise<CaseBoard[]>;
  getCaseBoard(id: string): Promise<CaseBoard | null>;
}
```

Create `src/storage/repositories/index.ts`:

```ts
export type { CaseBoardRepository } from './case-board-repository';
```

- [ ] **Step 8: Run storage and domain tests**

Run:

```powershell
npm test -- src/domain/types.test.ts src/storage/storage-error.test.ts
npm run build
```

Expected: PASS for tests and build.

- [ ] **Step 9: Commit domain and storage contracts**

Run:

```powershell
git add src/domain src/storage
git commit -m "Add domain types and storage contracts" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Add IndexedDB Initialization Adapter

**Files:**
- Create: `src/storage/indexeddb/object-stores.ts`
- Create: `src/storage/indexeddb/indexed-db-client.ts`
- Create: `src/storage/indexeddb/indexed-db-client.test.ts`
- Create: `src/storage/indexeddb/index.ts`

- [ ] **Step 1: Write failing IndexedDB adapter tests**

Create `src/storage/indexeddb/indexed-db-client.test.ts`:

```ts
import { IndexedDbClient } from './indexed-db-client';
import { OBJECT_STORES } from './object-stores';

function uniqueDatabaseName() {
  return `murderboard-test-${Math.random().toString(36).slice(2)}`;
}

describe('IndexedDbClient', () => {
  it('initializes the configured object stores', async () => {
    const dbName = uniqueDatabaseName();
    const client = new IndexedDbClient({ dbName });

    const db = await client.init();

    expect(Array.from(db.objectStoreNames)).toEqual(
      expect.arrayContaining([...OBJECT_STORES]),
    );

    db.close();
  });

  it('surfaces initialization failures with database context', async () => {
    const client = new IndexedDbClient({
      dbName: 'murderboard-failing-test',
      openDatabase: () => {
        throw new Error('open failed');
      },
    });

    await expect(client.init()).rejects.toMatchObject({
      name: 'StorageInitializationError',
      databaseName: 'murderboard-failing-test',
    });
  });
});
```

- [ ] **Step 2: Run IndexedDB tests and verify they fail**

Run:

```powershell
npm test -- src/storage/indexeddb/indexed-db-client.test.ts
```

Expected: FAIL because the IndexedDB adapter files do not exist.

- [ ] **Step 3: Add IndexedDB schema constants**

Create `src/storage/indexeddb/object-stores.ts`:

```ts
export const INDEXED_DB_NAME = 'murderboard';
export const INDEXED_DB_VERSION = 1;

export const OBJECT_STORES = [
  'caseBoards',
  'entities',
  'timelineEvents',
  'evidenceItems',
  'notes',
  'trashEntries',
  'archiveEntries',
  'schemaMetadata',
] as const;

export type ObjectStoreName = (typeof OBJECT_STORES)[number];
```

- [ ] **Step 4: Add the IndexedDB client**

Create `src/storage/indexeddb/indexed-db-client.ts`:

```ts
import { StorageInitializationError } from '../storage-error';
import {
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  OBJECT_STORES,
} from './object-stores';

export type OpenDatabase = (name: string, version: number) => IDBOpenDBRequest;

export interface IndexedDbClientOptions {
  dbName?: string;
  version?: number;
  openDatabase?: OpenDatabase;
}

export class IndexedDbClient {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly options: IndexedDbClientOptions = {}) {}

  init(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.open();
    }

    return this.dbPromise;
  }

  private open(): Promise<IDBDatabase> {
    const dbName = this.options.dbName ?? INDEXED_DB_NAME;
    const version = this.options.version ?? INDEXED_DB_VERSION;
    const openDatabase =
      this.options.openDatabase ?? indexedDB.open.bind(indexedDB);

    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;

      try {
        request = openDatabase(dbName, version);
      } catch (error) {
        reject(new StorageInitializationError(dbName, error));
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;

        for (const storeName of OBJECT_STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      };

      request.onerror = () => {
        reject(new StorageInitializationError(dbName, request.error));
      };

      request.onblocked = () => {
        reject(
          new StorageInitializationError(
            dbName,
            new Error('IndexedDB upgrade was blocked by an open connection.'),
          ),
        );
      };

      request.onsuccess = () => {
        resolve(request.result);
      };
    });
  }
}
```

Create `src/storage/indexeddb/index.ts`:

```ts
export { IndexedDbClient } from './indexed-db-client';
export type { IndexedDbClientOptions, OpenDatabase } from './indexed-db-client';
export {
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  OBJECT_STORES,
} from './object-stores';
export type { ObjectStoreName } from './object-stores';
```

- [ ] **Step 5: Run IndexedDB tests and build**

Run:

```powershell
npm test -- src/storage/indexeddb/indexed-db-client.test.ts
npm run build
```

Expected: PASS for tests and build.

- [ ] **Step 6: Commit IndexedDB initialization**

Run:

```powershell
git add src/storage/indexeddb
git commit -m "Add IndexedDB initialization adapter" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Add Shared Loading, Empty, Error, and Boundary Components

**Files:**
- Create: `src/shared/state/EmptyState.tsx`
- Create: `src/shared/state/ErrorBoundary.tsx`
- Create: `src/shared/state/ErrorState.tsx`
- Create: `src/shared/state/LoadingState.tsx`
- Create: `src/shared/state/index.ts`
- Create: `src/shared/state/state-components.test.tsx`

- [ ] **Step 1: Write failing shared state component tests**

Create `src/shared/state/state-components.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  LoadingState,
} from './index';

function ThrowingComponent() {
  throw new Error('render failed');
}

describe('shared state components', () => {
  it('renders loading status text', () => {
    render(<LoadingState message="Loading boards" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading boards');
  });

  it('renders empty state title and message', () => {
    render(
      <EmptyState
        title="No cases yet"
        message="Create a case board to begin."
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'No cases yet' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Create a case board to begin.')).toBeInTheDocument();
  });

  it('renders error state as an alert', () => {
    render(
      <ErrorState title="Storage unavailable" message="Try reloading the app." />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Try reloading the app.');
  });

  it('catches render errors with the error boundary', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onError = vi.fn();

    try {
      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
    } finally {
      consoleError.mockRestore();
    }

    expect(screen.getByRole('alert')).toHaveTextContent(
      'MurderBoard hit an unexpected error.',
    );
    expect(onError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run shared state tests and verify they fail**

Run:

```powershell
npm test -- src/shared/state/state-components.test.tsx
```

Expected: FAIL because shared state components do not exist.

- [ ] **Step 3: Add shared state components**

Create `src/shared/state/LoadingState.tsx`:

```tsx
interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return <p role="status">{message}</p>;
}
```

Create `src/shared/state/EmptyState.tsx`:

```tsx
interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <section aria-labelledby="empty-state-title" className="state-card">
      <h2 id="empty-state-title">{title}</h2>
      <p>{message}</p>
    </section>
  );
}
```

Create `src/shared/state/ErrorState.tsx`:

```tsx
interface ErrorStateProps {
  title: string;
  message: string;
}

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <section role="alert" className="state-card state-card--error">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}
```

Create `src/shared/state/ErrorBoundary.tsx`:

```tsx
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          title="MurderBoard hit an unexpected error."
          message="Reload the app and try again."
        />
      );
    }

    return this.props.children;
  }
}
```

Create `src/shared/state/index.ts`:

```ts
export { EmptyState } from './EmptyState';
export { ErrorBoundary } from './ErrorBoundary';
export { ErrorState } from './ErrorState';
export { LoadingState } from './LoadingState';
```

- [ ] **Step 4: Run shared state tests and build**

Run:

```powershell
npm test -- src/shared/state/state-components.test.tsx
npm run build
```

Expected: PASS for tests and build.

- [ ] **Step 5: Commit shared state components**

Run:

```powershell
git add src/shared/state
git commit -m "Add shared app state components" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Add App Layout, Routes, and Feature Stub Pages

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/app/App.test.tsx`
- Create: `src/app/routes.tsx`
- Create: `src/app/routes.test.tsx`
- Create: `src/app/layout/AppLayout.tsx`
- Create: `src/app/layout/AppLayout.test.tsx`
- Create: `src/app/layout/RouteError.tsx`
- Create: `src/features/home/HomePage.tsx`
- Create: `src/features/cases/CasesPage.tsx`
- Create: `src/features/entities/EntitiesPage.tsx`
- Create: `src/features/timeline/TimelinePage.tsx`
- Create: `src/features/evidence/EvidencePage.tsx`
- Create: `src/features/notes/NotesPage.tsx`
- Create: `src/features/trash/TrashPage.tsx`
- Create: `src/features/archive/ArchivePage.tsx`
- Create: `src/features/route-stub/RouteStubPage.tsx`

- [ ] **Step 1: Replace the smoke test with router-aware app tests**

Replace `src/app/App.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

describe('App routes', () => {
  it('renders the MurderBoard home route', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { name: 'MurderBoard' }),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write failing route coverage tests**

Create `src/app/routes.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);
}

describe('routes', () => {
  it.each([
    ['/', 'MurderBoard'],
    ['/cases', 'Cases'],
    ['/entities', 'Entities'],
    ['/timeline', 'Timeline'],
    ['/evidence', 'Evidence'],
    ['/notes', 'Notes'],
    ['/trash', 'Trash'],
    ['/archive', 'Archive'],
  ])('renders %s', async (path, heading) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
  });
});
```

Create `src/app/layout/AppLayout.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../routes';

describe('AppLayout', () => {
  it('renders navigation for the main product areas', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('link', { name: 'Cases' })).toHaveAttribute(
      'href',
      '/cases',
    );
    expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute(
      'href',
      '/timeline',
    );
    expect(screen.getByRole('link', { name: 'Trash' })).toHaveAttribute(
      'href',
      '/trash',
    );
    expect(screen.getByRole('link', { name: 'Archive' })).toHaveAttribute(
      'href',
      '/archive',
    );
  });
});
```

- [ ] **Step 3: Run app route tests and verify they fail**

Run:

```powershell
npm test -- src/app/App.test.tsx src/app/routes.test.tsx src/app/layout/AppLayout.test.tsx
```

Expected: FAIL because routes, layout, and feature pages do not exist.

- [ ] **Step 4: Add the reusable route stub page**

Create `src/features/route-stub/RouteStubPage.tsx`:

```tsx
import { EmptyState } from '../../shared/state';

interface RouteStubPageProps {
  title: string;
  message: string;
}

export function RouteStubPage({ title, message }: RouteStubPageProps) {
  return (
    <section aria-labelledby={`${title.toLowerCase()}-title`}>
      <h1 id={`${title.toLowerCase()}-title`}>{title}</h1>
      <EmptyState title={`${title} workspace`} message={message} />
    </section>
  );
}
```

- [ ] **Step 5: Add feature route pages**

Create `src/features/home/HomePage.tsx`:

```tsx
export function HomePage() {
  return (
    <section aria-labelledby="home-title">
      <h1 id="home-title">MurderBoard</h1>
      <p>
        Local-first workspace for organizing mystery cases, entities,
        timelines, evidence, and notes.
      </p>
    </section>
  );
}
```

Create `src/features/cases/CasesPage.tsx`:

```tsx
import { RouteStubPage } from '../route-stub/RouteStubPage';

export function CasesPage() {
  return (
    <RouteStubPage
      title="Cases"
      message="Case board creation and selection will appear here."
    />
  );
}
```

Create `src/features/entities/EntitiesPage.tsx`:

```tsx
import { RouteStubPage } from '../route-stub/RouteStubPage';

export function EntitiesPage() {
  return (
    <RouteStubPage
      title="Entities"
      message="Characters, locations, objects, organizations, and concepts will appear here."
    />
  );
}
```

Create `src/features/timeline/TimelinePage.tsx`:

```tsx
import { RouteStubPage } from '../route-stub/RouteStubPage';

export function TimelinePage() {
  return (
    <RouteStubPage
      title="Timeline"
      message="Chronological case events will appear here."
    />
  );
}
```

Create `src/features/evidence/EvidencePage.tsx`:

```tsx
import { RouteStubPage } from '../route-stub/RouteStubPage';

export function EvidencePage() {
  return (
    <RouteStubPage
      title="Evidence"
      message="Evidence items and source notes will appear here."
    />
  );
}
```

Create `src/features/notes/NotesPage.tsx`:

```tsx
import { RouteStubPage } from '../route-stub/RouteStubPage';

export function NotesPage() {
  return (
    <RouteStubPage
      title="Notes"
      message="Case notes and analysis drafts will appear here."
    />
  );
}
```

Create `src/features/trash/TrashPage.tsx`:

```tsx
import { RouteStubPage } from '../route-stub/RouteStubPage';

export function TrashPage() {
  return (
    <RouteStubPage
      title="Trash"
      message="Deleted items and recovery actions will appear here."
    />
  );
}
```

Create `src/features/archive/ArchivePage.tsx`:

```tsx
import { RouteStubPage } from '../route-stub/RouteStubPage';

export function ArchivePage() {
  return (
    <RouteStubPage
      title="Archive"
      message="Archived case boards and restore actions will appear here."
    />
  );
}
```

- [ ] **Step 6: Add layout, route error renderer, and route definitions**

Create `src/app/layout/AppLayout.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/cases', label: 'Cases' },
  { to: '/entities', label: 'Entities' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/notes', label: 'Notes' },
  { to: '/trash', label: 'Trash' },
  { to: '/archive', label: 'Archive' },
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink className="brand" to="/">
          MurderBoard
        </NavLink>
        <nav aria-label="Primary navigation" className="app-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
```

Create `src/app/layout/RouteError.tsx`:

```tsx
import { useRouteError } from 'react-router-dom';
import { ErrorState } from '../../shared/state';

export function RouteError() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : 'The requested MurderBoard route could not be loaded.';

  return <ErrorState title="Route unavailable" message={message} />;
}
```

Create `src/app/routes.tsx`:

```tsx
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { RouteError } from './layout/RouteError';
import { ArchivePage } from '../features/archive/ArchivePage';
import { CasesPage } from '../features/cases/CasesPage';
import { EntitiesPage } from '../features/entities/EntitiesPage';
import { EvidencePage } from '../features/evidence/EvidencePage';
import { HomePage } from '../features/home/HomePage';
import { NotesPage } from '../features/notes/NotesPage';
import { TimelinePage } from '../features/timeline/TimelinePage';
import { TrashPage } from '../features/trash/TrashPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'cases', element: <CasesPage /> },
      { path: 'entities', element: <EntitiesPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'evidence', element: <EvidencePage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'trash', element: <TrashPage /> },
      { path: 'archive', element: <ArchivePage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
```

- [ ] **Step 7: Wire App to the router and global error boundary**

Replace `src/app/App.tsx` with:

```tsx
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../shared/state';
import { createAppRouter } from './routes';

const router = createAppRouter();

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
```

- [ ] **Step 8: Run app route tests and build**

Run:

```powershell
npm test -- src/app/App.test.tsx src/app/routes.test.tsx src/app/layout/AppLayout.test.tsx
npm run build
```

Expected: PASS for tests and build.

- [ ] **Step 9: Commit routes and feature pages**

Run:

```powershell
git add src/app src/features
git commit -m "Add app routes and feature pages" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 6: Add App Styling, Developer Documentation, and Full Verification

**Files:**
- Modify: `src/main.tsx`
- Create: `src/app/styles.css`
- Modify: `README.md`

- [ ] **Step 1: Add base app styles**

Create `src/app/styles.css`:

```css
:root {
  color: #172033;
  background: #f5f2ec;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

a {
  color: inherit;
}

.app-shell {
  min-height: 100vh;
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #ddd4c4;
  background: #fffaf2;
}

.brand {
  font-size: 1.25rem;
  font-weight: 700;
  text-decoration: none;
}

.app-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.app-nav a {
  border-radius: 999px;
  padding: 0.4rem 0.75rem;
  text-decoration: none;
}

.app-nav a.active {
  background: #31251b;
  color: #fffaf2;
}

.app-main {
  width: min(1120px, 100%);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.state-card {
  max-width: 42rem;
  margin-top: 1rem;
  border: 1px solid #ddd4c4;
  border-radius: 16px;
  padding: 1rem;
  background: #fffaf2;
}

.state-card--error {
  border-color: #b42318;
  color: #7a271a;
}
```

- [ ] **Step 2: Import styles in the browser entry**

Replace `src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Add developer commands to README**

Append this section to `README.md`:

````markdown
## Development

Install dependencies:

```powershell
npm install
```

Run the local development server:

```powershell
npm run dev
```

Run the test suite:

```powershell
npm test
```

Build the app:

```powershell
npm run build
```
````

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm test
npm run build
```

Expected: all tests PASS and the production build succeeds.

- [ ] **Step 5: Commit styling and docs**

Run:

```powershell
git add src/main.tsx src/app/styles.css README.md
git commit -m "Add app styling and development docs" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 6: Confirm final repository state**

Run:

```powershell
git --no-pager status --short
```

Expected: no tracked implementation files are uncommitted. If `.superpowers/` appears, leave it uncommitted because it contains brainstorming companion artifacts.
