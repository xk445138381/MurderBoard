import type { ContentTypeTemplate } from "../domain/types";

export interface TemplateRepository {
  getAll(): Promise<ContentTypeTemplate[]>;
  getById(id: string): Promise<ContentTypeTemplate | null>;
  create(template: ContentTypeTemplate): Promise<ContentTypeTemplate>;
}

export class IndexedDbTemplateRepository implements TemplateRepository {
  constructor(private readonly client: {
    init(): Promise<IDBDatabase>;
  }) {}

  private async db(): Promise<IDBDatabase> {
    return this.client.init();
  }

  async getAll(): Promise<ContentTypeTemplate[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("templates", "readonly");
      const store = tx.objectStore("templates");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<ContentTypeTemplate | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("templates", "readonly");
      const store = tx.objectStore("templates");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async create(template: ContentTypeTemplate): Promise<ContentTypeTemplate> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("templates", "readwrite");
      const store = tx.objectStore("templates");
      const request = store.add(template);
      request.onsuccess = () => resolve(template);
      request.onerror = () => reject(request.error);
    });
  }
}
