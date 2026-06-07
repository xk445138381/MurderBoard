import type { ContentRelation } from "../domain/types";

export interface RelationRepository {
  create(relation: ContentRelation): Promise<ContentRelation>;
  getBySourceItem(itemId: string): Promise<ContentRelation[]>;
  getByTargetItem(itemId: string): Promise<ContentRelation[]>;
  update(relation: ContentRelation): Promise<ContentRelation>;
  delete(id: string): Promise<void>;
}

export class IndexedDbRelationRepository implements RelationRepository {
  constructor(private readonly client: {
    init(): Promise<IDBDatabase>;
  }) {}

  private async db(): Promise<IDBDatabase> {
    return this.client.init();
  }

  async create(relation: ContentRelation): Promise<ContentRelation> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentRelations", "readwrite");
      const store = tx.objectStore("contentRelations");
      const request = store.add(relation);
      request.onsuccess = () => resolve(relation);
      request.onerror = () => reject(request.error);
    });
  }

  async getBySourceItem(itemId: string): Promise<ContentRelation[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentRelations", "readonly");
      const store = tx.objectStore("contentRelations");
      const index = store.index("fromContentItemId");
      const request = index.getAll(itemId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getByTargetItem(itemId: string): Promise<ContentRelation[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentRelations", "readonly");
      const store = tx.objectStore("contentRelations");
      const index = store.index("toContentItemId");
      const request = index.getAll(itemId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async update(relation: ContentRelation): Promise<ContentRelation> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentRelations", "readwrite");
      const store = tx.objectStore("contentRelations");
      const request = store.put(relation);
      request.onsuccess = () => resolve(relation);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("contentRelations", "readwrite");
      const store = tx.objectStore("contentRelations");
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
