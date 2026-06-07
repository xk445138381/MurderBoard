import type { ContentTypeTemplate, ContentType, Game } from "../domain/types";
import { instantiateContentType } from "../domain/types";

export interface GameRepository {
  create(game: Game): Promise<Game>;
  getById(id: string): Promise<Game | null>;
  getAll(): Promise<Game[]>;
  update(game: Game): Promise<Game>;
}

export class IndexedDbGameRepository implements GameRepository {
  constructor(private readonly client: {
    init(): Promise<IDBDatabase>;
  }) {}

  private async db(): Promise<IDBDatabase> {
    return this.client.init();
  }

  async create(game: Game): Promise<Game> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("games", "readwrite");
      const store = tx.objectStore("games");
      const request = store.add(game);
      request.onsuccess = () => resolve(game);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<Game | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("games", "readonly");
      const store = tx.objectStore("games");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(): Promise<Game[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("games", "readonly");
      const store = tx.objectStore("games");
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async update(game: Game): Promise<Game> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("games", "readwrite");
      const store = tx.objectStore("games");
      const request = store.put(game);
      request.onsuccess = () => resolve(game);
      request.onerror = () => reject(request.error);
    });
  }
}

export function buildGameFromTemplates(
  gameId: string,
  gameName: string,
  now: string,
  templates: ContentTypeTemplate[],
  idGen: () => string,
): Game {
  const contentTypes: ContentType[] = templates.map((tpl) =>
    instantiateContentType(tpl, gameId, idGen),
  );

  return {
    id: gameId,
    name: gameName,
    contentTypes,
    createdAt: now,
    updatedAt: now,
  };
}
