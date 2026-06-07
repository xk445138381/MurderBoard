import type { ContentItem } from "../domain/types";

export interface ContentItemRepository {
  create(item: ContentItem): Promise<ContentItem>;
  getById(id: string): Promise<ContentItem | null>;
  getByGame(gameId: string): Promise<ContentItem[]>;
  update(item: ContentItem): Promise<ContentItem>;
  delete(id: string): Promise<void>;
}

export class IndexedDbContentItemRepository implements ContentItemRepository {
  constructor(private readonly client: {
    init(): Promise<IDBDatabase>;
  }) {}

  private async db(): Promise<IDBDatabase> {
    return this.client.init();
  }

  async create(item: ContentItem): Promise<ContentItem> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentItems", "readwrite");
      const store = tx.objectStore("contentItems");
      const request = store.add(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<ContentItem | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentItems", "readonly");
      const store = tx.objectStore("contentItems");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async getByGame(gameId: string): Promise<ContentItem[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentItems", "readonly");
      const store = tx.objectStore("contentItems");
      const index = store.index("gameId");
      const request = index.getAll(gameId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async update(item: ContentItem): Promise<ContentItem> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentItems", "readwrite");
      const store = tx.objectStore("contentItems");
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentItems", "readwrite");
      const store = tx.objectStore("contentItems");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
