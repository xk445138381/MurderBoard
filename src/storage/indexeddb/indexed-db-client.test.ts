import { IndexedDbClient } from './indexed-db-client';
import { OBJECT_STORE_INDEXES, OBJECT_STORES } from './object-stores';

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

  it('initializes indexes for constrained stores', async () => {
    const dbName = uniqueDatabaseName();
    const client = new IndexedDbClient({ dbName });

    const db = await client.init();
    const transaction = db.transaction(['workspaces', 'cases'], 'readonly');
    const workspaceStore = transaction.objectStore('workspaces');
    const caseStore = transaction.objectStore('cases');

    expect(Array.from(workspaceStore.indexNames)).toEqual(
      expect.arrayContaining(OBJECT_STORE_INDEXES.workspaces.map((index) => index.name)),
    );
    expect(Array.from(caseStore.indexNames)).toEqual(
      expect.arrayContaining(OBJECT_STORE_INDEXES.cases.map((index) => index.name)),
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
