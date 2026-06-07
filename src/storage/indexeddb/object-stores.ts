export const INDEXED_DB_NAME = "murderboard";
export const INDEXED_DB_VERSION = 4;

export const OBJECT_STORES = [
  "workspaces",
  "templates",
  "games",
  "contentItems",
  "boards",
  "nodePositions",
  "contentRelations",
  "cases",
  "characters",
  "clues",
  "events",
  "eventCharacters",
  "eventClues",
  "schemaMetadata",
  "hypotheses",
  "boardRelations",
  "boardNodePositions",
] as const;

export type ObjectStoreName = (typeof OBJECT_STORES)[number];

export interface ObjectStoreIndexDefinition {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
}

export const OBJECT_STORE_INDEXES: Record<
  ObjectStoreName,
  ObjectStoreIndexDefinition[]
> = {
  workspaces: [
    { name: "name", keyPath: "name", options: { unique: true } },
    { name: "deletedAt", keyPath: "deletedAt" },
  ],
  templates: [
    { name: "name", keyPath: "name", options: { unique: true } },
  ],
  games: [
    { name: "name", keyPath: "name", options: { unique: true } },
  ],
  contentItems: [{ name: "gameId", keyPath: "gameId" }],
  boards: [{ name: "gameId", keyPath: "gameId" }],
  nodePositions: [
    {
      name: "boardContentItem",
      keyPath: ["boardId", "contentItemId"],
      options: { unique: true },
    },
  ],
  contentRelations: [
    { name: "fromContentItemId", keyPath: "fromContentItemId" },
    { name: "toContentItemId", keyPath: "toContentItemId" },
  ],
  cases: [
    { name: "workspaceId", keyPath: "workspaceId" },
    {
      name: "workspaceIdName",
      keyPath: ["workspaceId", "name"],
      options: { unique: true },
    },
    { name: "workspaceIdStatus", keyPath: ["workspaceId", "status"] },
    { name: "deletedAt", keyPath: "deletedAt" },
  ],
  characters: [
    { name: "caseId", keyPath: "caseId" },
    { name: "deletedAt", keyPath: "deletedAt" },
  ],
  clues: [
    { name: "caseId", keyPath: "caseId" },
    { name: "deletedAt", keyPath: "deletedAt" },
  ],
  events: [
    { name: "caseId", keyPath: "caseId" },
    { name: "caseIdOccurredAt", keyPath: ["caseId", "occurredAt"] },
    { name: "deletedAt", keyPath: "deletedAt" },
  ],
  eventCharacters: [
    { name: "eventId", keyPath: "eventId" },
    { name: "characterId", keyPath: "characterId" },
  ],
  eventClues: [
    { name: "eventId", keyPath: "eventId" },
    { name: "clueId", keyPath: "clueId" },
  ],
  schemaMetadata: [],
  hypotheses: [
    { name: "caseId", keyPath: "caseId" },
    { name: "deletedAt", keyPath: "deletedAt" },
  ],
  boardRelations: [
    { name: "caseId", keyPath: "caseId" },
    { name: "fromNode", keyPath: ["fromNodeType", "fromNodeId"] },
    { name: "toNode", keyPath: ["toNodeType", "toNodeId"] },
    { name: "deletedAt", keyPath: "deletedAt" },
  ],
  boardNodePositions: [
    { name: "caseId", keyPath: "caseId" },
    {
      name: "caseNode",
      keyPath: ["caseId", "nodeType", "nodeId"],
      options: { unique: true },
    },
  ],
};
