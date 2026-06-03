export const INDEXED_DB_NAME = 'murderboard';
export const INDEXED_DB_VERSION = 1;

export const OBJECT_STORES = [
  'caseBoards',
  'entities',
  'timelineEvents',
  'evidenceItems',
  'notes',
  'trashEntries',
  'archiveEntries',
  'schemaMetadata',
] as const;

export type ObjectStoreName = (typeof OBJECT_STORES)[number];
