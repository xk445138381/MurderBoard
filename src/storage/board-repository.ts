import type { Board, NodePosition } from "../domain/types";

export interface BoardRepository {
  create(board: Board): Promise<Board>;
  getById(id: string): Promise<Board | null>;
  getByGame(gameId: string): Promise<Board[]>;
  saveNodePosition(pos: NodePosition): Promise<void>;
  getNodePositions(boardId: string): Promise<NodePosition[]>;
  removeNodePosition(contentItemId: string, boardId: string): Promise<void>;
}

export class IndexedDbBoardRepository implements BoardRepository {
  constructor(private readonly client: {
    init(): Promise<IDBDatabase>;
  }) {}

  private async db(): Promise<IDBDatabase> {
    return this.client.init();
  }

  async create(board: Board): Promise<Board> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("boards", "readwrite");
      const store = tx.objectStore("boards");
      const request = store.add(board);
      request.onsuccess = () => resolve(board);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: string): Promise<Board | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("boards", "readonly");
      const store = tx.objectStore("boards");
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async getByGame(gameId: string): Promise<Board[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("boards", "readonly");
      const store = tx.objectStore("boards");
      const index = store.index("gameId");
      const request = index.getAll(gameId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNodePosition(pos: NodePosition): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("nodePositions", "readwrite");
      const store = tx.objectStore("nodePositions");
      const compositeId = `${pos.boardId}::${pos.contentItemId}`;
      const record = { ...pos, boardContentItem: compositeId };
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getNodePositions(boardId: string): Promise<NodePosition[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("nodePositions", "readonly");
      const store = tx.objectStore("nodePositions");
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result;
        resolve(all.filter((p) => p.boardId === boardId));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeNodePosition(contentItemId: string, boardId: string): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("nodePositions", "readwrite");
      const store = tx.objectStore("nodePositions");
      const compositeId = `${boardId}::${contentItemId}`;
      const request = store.delete(compositeId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
