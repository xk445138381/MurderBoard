export type IsoDateString = string;

export const CORE_ENTITY_TYPES = [
  'character',
  'location',
  'object',
  'organization',
  'concept',
] as const;

export type CoreEntityType = (typeof CORE_ENTITY_TYPES)[number];

export type CaseBoardStatus = 'active' | 'archived';

export interface CaseBoard {
  id: string;
  title: string;
  description: string;
  status: CaseBoardStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  archivedAt: IsoDateString | null;
}

export interface BoardEntity {
  id: string;
  caseBoardId: string;
  type: CoreEntityType;
  name: string;
  summary: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface TimelineEvent {
  id: string;
  caseBoardId: string;
  title: string;
  occurredAt: IsoDateString;
  description: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface EvidenceItem {
  id: string;
  caseBoardId: string;
  title: string;
  source: string;
  notes: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Note {
  id: string;
  caseBoardId: string;
  title: string;
  body: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface TrashEntry {
  id: string;
  caseBoardId: string;
  itemType: string;
  itemId: string;
  deletedAt: IsoDateString;
}

export interface ArchiveEntry {
  id: string;
  caseBoardId: string;
  archivedAt: IsoDateString;
  restoredAt: IsoDateString | null;
}

export function isCoreEntityType(value: string): value is CoreEntityType {
  return CORE_ENTITY_TYPES.includes(value as CoreEntityType);
}
