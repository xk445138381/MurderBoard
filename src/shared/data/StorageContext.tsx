import React, { createContext, useContext, useEffect, useState } from "react";
import { IndexedDbClient } from "../../storage/indexeddb/indexed-db-client";
import {
  IndexedDbTemplateRepository,
  type TemplateRepository,
} from "../../storage/template-repository";
import {
  IndexedDbGameRepository,
  type GameRepository,
} from "../../storage/game-repository";
import {
  IndexedDbContentItemRepository,
  type ContentItemRepository,
} from "../../storage/content-item-repository";
import {
  IndexedDbBoardRepository,
  type BoardRepository,
} from "../../storage/board-repository";
import {
  IndexedDbRelationRepository,
  type RelationRepository,
} from "../../storage/relation-repository";

interface Repositories {
  templates: TemplateRepository;
  games: GameRepository;
  contentItems: ContentItemRepository;
  boards: BoardRepository;
  relations: RelationRepository;
}

const RepoContext = createContext<Repositories | null>(null);

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [repos, setRepos] = useState<Repositories | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const client = new IndexedDbClient();
    client
      .init()
      .then(() => {
        setRepos({
          templates: new IndexedDbTemplateRepository(client),
          games: new IndexedDbGameRepository(client),
          contentItems: new IndexedDbContentItemRepository(client),
          boards: new IndexedDbBoardRepository(client),
          relations: new IndexedDbRelationRepository(client),
        });
      })
      .catch(setError);
  }, []);

  if (error) {
    return (
      <div style={{ padding: 24, color: "#ef4444" }}>
        <strong>存储初始化失败</strong>
        <pre style={{ fontSize: 13 }}>{error.message}</pre>
      </div>
    );
  }

  if (!repos) {
    return (
      <div style={{ padding: 24, color: "#888" }}>加载中...</div>
    );
  }

  return <RepoContext.Provider value={repos}>{children}</RepoContext.Provider>;
}

function useRepos(): Repositories {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error("useRepos must be used within StorageProvider");
  return ctx;
}

export function useTemplateRepository(): TemplateRepository {
  return useRepos().templates;
}

export function useGameRepository(): GameRepository {
  return useRepos().games;
}

export function useContentItemRepository(): ContentItemRepository {
  return useRepos().contentItems;
}

export function useBoardRepository(): BoardRepository {
  return useRepos().boards;
}

export function useRelationRepository(): RelationRepository {
  return useRepos().relations;
}
