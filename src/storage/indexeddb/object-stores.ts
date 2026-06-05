export const INDEXED_DB_NAME = 'murderboard';
export const INDEXED_DB_VERSION = 2;

export const OBJECT_STORES = [
  'workspaces',
  'cases',
  'characters',
  'clues',
  'events',
  'eventCharacters',
  'eventClues',
  'schemaMetadata',
] as const;

export type ObjectStoreName = (typeof OBJECT_STORES)[number];

export interface ObjectStoreIndexDefinition {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
}

export const OBJECT_STORE_INDEXES: Record<ObjectStoreName, ObjectStoreIndexDefinition[]> = {
  workspaces: [
    { name: 'name', keyPath: 'name', options: { unique: true } },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
  cases: [
    { name: 'workspaceId', keyPath: 'workspaceId' },
    { name: 'workspaceIdName', keyPath: ['workspaceId', 'name'], options: { unique: true } },
    { name: 'workspaceIdStatus', keyPath: ['workspaceId', 'status'] },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
  characters: [
    { name: 'caseId', keyPath: 'caseId' },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
  clues: [
    { name: 'caseId', keyPath: 'caseId' },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
  events: [
    { name: 'caseId', keyPath: 'caseId' },
    { name: 'caseIdOccurredAt', keyPath: ['caseId', 'occurredAt'] },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
  eventCharacters: [
    { name: 'eventId', keyPath: 'eventId' },
    { name: 'characterId', keyPath: 'characterId' },
  ],
  eventClues: [
    { name: 'eventId', keyPath: 'eventId' },
    { name: 'clueId', keyPath: 'clueId' },
  ],
  schemaMetadata: [],
};
