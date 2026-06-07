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

export const BOARD_NODE_TYPES = ['person', 'clue', 'event', 'hypothesis'] as const;

export type BoardNodeType = (typeof BOARD_NODE_TYPES)[number];

export const BOARD_RELATION_TYPES = [
  'related',
  'supports',
  'refutes',
  'sequence',
  'suspect',
] as const;

export type BoardRelationType = (typeof BOARD_RELATION_TYPES)[number];

export const HYPOTHESIS_STATUSES = ['unverified', 'plausible', 'refuted'] as const;

export type HypothesisStatus = (typeof HYPOTHESIS_STATUSES)[number];

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

export interface Hypothesis extends SoftDeletableEntity {
  caseId: string;
  title: string;
  body: string;
  status: HypothesisStatus;
  confidence: number;
}

export interface BoardRelation extends SoftDeletableEntity {
  caseId: string;
  fromNodeType: BoardNodeType;
  fromNodeId: string;
  toNodeType: BoardNodeType;
  toNodeId: string;
  type: BoardRelationType;
  note: string;
}

export interface BoardNodePosition {
  id: string;
  caseId: string;
  nodeType: BoardNodeType;
  nodeId: string;
  x: number;
  y: number;
  updatedAt: IsoDateString;
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

export function isBoardNodeType(value: string): value is BoardNodeType {
  return BOARD_NODE_TYPES.includes(value as BoardNodeType);
}

export function isBoardRelationType(value: string): value is BoardRelationType {
  return BOARD_RELATION_TYPES.includes(value as BoardRelationType);
}

export function isHypothesisStatus(value: string): value is HypothesisStatus {
  return HYPOTHESIS_STATUSES.includes(value as HypothesisStatus);
}

export function isIsoDateString(value: string): value is IsoDateString {
  return ISO_DATE_TIME_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

// ===== Configurable Content Type System (ADR-0001) =====

// --- Field Type Pool ---

export const FIELD_TYPES = [
  "single-line-text",
  "multi-line-text",
  "datetime",
  "date-range",
  "number",
  "enum",
  "boolean",
  "reference",
  "unlock-block",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  "single-line-text": "单行文本",
  "multi-line-text": "多行文本",
  datetime: "日期时间",
  "date-range": "日期范围",
  number: "数字",
  enum: "枚举",
  boolean: "布尔",
  reference: "引用",
  "unlock-block": "解锁块",
};

// --- Field Definition ---

export interface FieldDefinition {
  name: string;
  type: FieldType;
  required: boolean;
  enumOptions?: string[];
}

// --- Board Node Visual ---

export const NODE_SHAPES = ["circle", "square", "diamond", "hexagon"] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

export interface BoardNodeVisual {
  color: string;
  shape: NodeShape;
}

// --- Content Type Template (global, immutable) ---

export interface ContentTypeTemplate {
  id: string;
  name: string;
  fields: FieldDefinition[];
  visual: BoardNodeVisual;
  unlockEnabled: boolean;
  createdAt: IsoDateString;
}

// --- Content Type (per-game, mutable copy) ---

export interface ContentType {
  id: string;
  gameId: string;
  templateId: string;
  name: string;
  fields: FieldDefinition[];
  visual: BoardNodeVisual;
  unlockEnabled: boolean;
}

// --- Acquisition Status ---

export const ACQUISITION_STATUSES = ["locked", "unlocked", "acquired"] as const;
export type AcquisitionStatus = (typeof ACQUISITION_STATUSES)[number];

// --- Unlock Block ---

export interface UnlockBlock {
  id: string;
  targetName: string;
  requiredPerson: string | null;
  requiredLocation: string | null;
  status: AcquisitionStatus;
}

// --- Content Item ---

export interface ContentItem {
  id: string;
  gameId: string;
  contentTypeId: string;
  title: string;
  fieldValues: Record<string, unknown>;
  unlockBlocks: UnlockBlock[];
  acquisitionStatus: AcquisitionStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

// --- Game ---

export interface Game {
  id: string;
  name: string;
  contentTypes: ContentType[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

// --- Board ---

export const BOARD_KINDS = ["sub", "master"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];

export interface Board {
  id: string;
  gameId: string;
  name: string;
  kind: BoardKind;
  indictmentId: string | null;
}

// --- Node Position ---

export interface NodePosition {
  contentItemId: string;
  boardId: string;
  x: number;
  y: number;
}

// --- Content Relation (inference, player-drawn) ---

export interface ContentRelation {
  id: string;
  fromContentItemId: string;
  toContentItemId: string;
  type: BoardRelationType;
  note: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

// --- Unlock Relation (computed, not persisted) ---

export interface UnlockRelation {
  fromContentItemId: string;
  toContentItemId: string;
  unlockBlockId: string;
}

// --- Type Guards ---

export function isFieldType(value: string): value is FieldType {
  return FIELD_TYPES.includes(value as FieldType);
}

export function isAcquisitionStatus(value: string): value is AcquisitionStatus {
  return ACQUISITION_STATUSES.includes(value as AcquisitionStatus);
}

export function isBoardKind(value: string): value is BoardKind {
  return BOARD_KINDS.includes(value as BoardKind);
}

export function isNodeShape(value: string): value is NodeShape {
  return NODE_SHAPES.includes(value as NodeShape);
}

// --- Domain Utilities ---

/**
 * Compare two field definition arrays for template merging.
 * Only compares field name + type (ignores required, enumOptions, order).
 */
export function fieldsMatch(a: FieldDefinition[], b: FieldDefinition[]): boolean {
  if (a.length !== b.length) return false;
  const key = (f: FieldDefinition) => `${f.name}:${f.type}`;
  const aSet = new Set(a.map(key));
  return b.every((f) => aSet.has(key(f)));
}

/**
 * Deep-copy a template into a game-specific ContentType.
 */
export function instantiateContentType(
  template: ContentTypeTemplate,
  gameId: string,
  idGenerator: () => string,
): ContentType {
  return {
    id: idGenerator(),
    gameId,
    templateId: template.id,
    name: template.name,
    fields: template.fields.map((f) => ({ ...f, enumOptions: f.enumOptions ? [...f.enumOptions] : undefined })),
    visual: { ...template.visual },
    unlockEnabled: template.unlockEnabled,
  };
}

/**
 * Compute unlock relations from a set of content items.
 * An unlock relation exists when item A has an unlock block whose
 * targetName matches item B"s title, and the block is not locked.
 */
export function computeUnlockRelations(items: ContentItem[]): UnlockRelation[] {
  const result: UnlockRelation[] = [];
  const titleIndex = new Map<string, ContentItem>();
  for (const item of items) {
    if (item.title) titleIndex.set(item.title, item);
  }
  for (const item of items) {
    for (const block of item.unlockBlocks) {
      if (block.status === "locked") continue;
      const target = titleIndex.get(block.targetName);
      if (target) {
        result.push({
          fromContentItemId: item.id,
          toContentItemId: target.id,
          unlockBlockId: block.id,
        });
      }
    }
  }
  return result;
}
