import { StorageInitializationError } from '../storage-error';
import {
  INDEXED_DB_NAME,
  INDEXED_DB_VERSION,
  OBJECT_STORE_INDEXES,
  OBJECT_STORES,
  type ObjectStoreName,
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
          const store = this.ensureObjectStore(db, request.transaction, storeName);
          this.ensureIndexes(store, OBJECT_STORE_INDEXES[storeName]);
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

  private ensureObjectStore(
    db: IDBDatabase,
    transaction: IDBTransaction | null,
    storeName: ObjectStoreName,
  ) {
    if (!db.objectStoreNames.contains(storeName)) {
      return db.createObjectStore(storeName, { keyPath: 'id' });
    }

    if (!transaction) {
      throw new StorageInitializationError(
        db.name,
        new Error(`Cannot upgrade existing object store "${storeName}" without a transaction.`),
      );
    }

    return transaction.objectStore(storeName);
  }

  private ensureIndexes(
    store: IDBObjectStore,
    indexDefinitions: (typeof OBJECT_STORE_INDEXES)[ObjectStoreName],
  ) {
    for (const indexDefinition of indexDefinitions) {
      if (!store.indexNames.contains(indexDefinition.name)) {
        store.createIndex(
          indexDefinition.name,
          indexDefinition.keyPath,
          indexDefinition.options,
        );
      }
    }
  }
}
