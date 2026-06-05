export type IsoDateString = string;

const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export const CORE_ENTITY_TYPES = [
  'character',
  'location',
  'object',
  'organization',
  'concept',
] as const;

export type CoreEntityType = (typeof CORE_ENTITY_TYPES)[number];

export const CASE_STATUSES = ['draft', 'active', 'archived', 'deleted'] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export type RestorableCaseStatus = Exclude<CaseStatus, 'deleted'>;

export interface SoftDeletableEntity {
  id: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  deletedAt: IsoDateString | null;
}

export interface Workspace extends SoftDeletableEntity {
  name: string;
  description: string;
}

export interface Case extends SoftDeletableEntity {
  workspaceId: string;
  name: string;
  status: CaseStatus;
  summary: string;
  archivedAt: IsoDateString | null;
  statusBeforeDelete: RestorableCaseStatus | null;
}

export interface Character extends SoftDeletableEntity {
  caseId: string;
  name: string;
  role: string;
  notes: string;
}

export interface Clue extends SoftDeletableEntity {
  caseId: string;
  title: string;
  content: string;
  source: string;
  discoveredAt: IsoDateString | null;
}

export interface Event extends SoftDeletableEntity {
  caseId: string;
  title: string;
  description: string;
  occurredAt: IsoDateString;
}

export interface EventCharacter {
  id: string;
  eventId: string;
  characterId: string;
}

export interface EventClue {
  id: string;
  eventId: string;
  clueId: string;
}

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

export function isCaseStatus(value: string): value is CaseStatus {
  return CASE_STATUSES.includes(value as CaseStatus);
}

export function isIsoDateString(value: string): value is IsoDateString {
  return ISO_DATE_TIME_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}
