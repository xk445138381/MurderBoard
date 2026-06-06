import type {
  BoardNodePosition,
  BoardNodeType,
  BoardRelation,
  BoardRelationType,
  Case,
  CaseStatus,
  Character,
  Clue,
  Event,
  EventCharacter,
  EventClue,
  Hypothesis,
  HypothesisStatus,
  IsoDateString,
  RestorableCaseStatus,
  Workspace,
} from '../../domain/types';

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
}

export interface CreateCaseInput {
  name: string;
  summary?: string;
  status?: CaseStatus;
}

export interface UpdateCaseInput {
  name?: string;
  summary?: string;
  status?: RestorableCaseStatus;
}

export interface CreateCharacterInput {
  name: string;
  role?: string;
  notes?: string;
}

export interface UpdateCharacterInput {
  name?: string;
  role?: string;
  notes?: string;
}

export interface CreateClueInput {
  title: string;
  content?: string;
  source?: string;
  discoveredAt?: IsoDateString | null;
}

export interface UpdateClueInput {
  title?: string;
  content?: string;
  source?: string;
  discoveredAt?: IsoDateString | null;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  occurredAt: IsoDateString;
  relatedCharacterIds?: string[];
  relatedClueIds?: string[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  occurredAt?: IsoDateString;
  relatedCharacterIds?: string[];
  relatedClueIds?: string[];
}

export interface CreateHypothesisInput {
  title: string;
  body?: string;
  status?: HypothesisStatus;
  confidence?: number;
}

export interface UpdateHypothesisInput {
  title?: string;
  body?: string;
  status?: HypothesisStatus;
  confidence?: number;
}

export interface CreateBoardRelationInput {
  fromNodeType: BoardNodeType;
  fromNodeId: string;
  toNodeType: BoardNodeType;
  toNodeId: string;
  type: BoardRelationType;
  note?: string;
}

export interface UpdateBoardRelationInput {
  type?: BoardRelationType;
  note?: string;
}

export interface SaveBoardNodePositionInput {
  nodeType: BoardNodeType;
  nodeId: string;
  x: number;
  y: number;
}

export interface CaseListOptions {
  status?: CaseStatus;
  includeDeleted?: boolean;
}

export interface ArchivedCaseListOptions {
  workspaceId?: string;
}

export interface RestoreArchivedCaseInput {
  targetWorkspaceId?: string;
  name?: string;
}

export interface CopyCaseInput {
  targetWorkspaceId?: string;
  name?: string;
  status?: RestorableCaseStatus;
}

export interface MoveCaseInput {
  targetWorkspaceId: string;
  name?: string;
}

export interface CaseImportCharacterInput {
  name: string;
  role?: string;
  notes?: string;
}

export interface CaseImportClueInput {
  title: string;
  content?: string;
  source?: string;
  discoveredAt?: IsoDateString | null;
}

export interface CaseImportEventInput {
  title: string;
  description?: string;
  occurredAt: IsoDateString;
  relatedCharacterNames?: string[];
  relatedClueTitles?: string[];
}

export interface CaseImportInput {
  name: string;
  summary?: string;
  status?: RestorableCaseStatus;
  characters?: CaseImportCharacterInput[];
  clues?: CaseImportClueInput[];
  events?: CaseImportEventInput[];
}

export interface CaseImportConflict {
  fieldName: string;
  message: string;
  value: string;
}

export interface CaseImportPreview {
  targetWorkspaceId: string;
  name: string;
  canImport: boolean;
  conflicts: CaseImportConflict[];
  counts: {
    characters: number;
    clues: number;
    events: number;
  };
}

export type TrashResourceType = 'workspace' | 'case' | 'character' | 'clue' | 'event';

export interface TrashEntry {
  id: string;
  resourceId: string;
  resourceType: TrashResourceType;
  label: string;
  parentLabel: string;
  deletedAt: IsoDateString;
}

export interface MurderBoardRepository {
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>;
  getWorkspace(id: string, options?: { includeDeleted?: boolean }): Promise<Workspace | null>;
  listWorkspaces(options?: { includeDeleted?: boolean }): Promise<Workspace[]>;
  updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace>;
  softDeleteWorkspace(id: string): Promise<Workspace>;
  restoreWorkspace(id: string): Promise<Workspace>;
  purgeWorkspace(id: string): Promise<void>;

  createCase(workspaceId: string, input: CreateCaseInput): Promise<Case>;
  getCase(id: string, options?: { includeDeleted?: boolean }): Promise<Case | null>;
  listCases(workspaceId: string, options?: CaseListOptions): Promise<Case[]>;
  updateCase(id: string, input: UpdateCaseInput): Promise<Case>;
  copyCase(id: string, input?: CopyCaseInput): Promise<Case>;
  moveCase(id: string, input: MoveCaseInput): Promise<Case>;
  archiveCase(id: string): Promise<Case>;
  listArchivedCases(options?: ArchivedCaseListOptions): Promise<Case[]>;
  restoreArchivedCase(id: string, input?: RestoreArchivedCaseInput): Promise<Case>;
  previewCaseImport(workspaceId: string, input: CaseImportInput): Promise<CaseImportPreview>;
  importCaseDraft(workspaceId: string, input: CaseImportInput): Promise<Case>;
  softDeleteCase(id: string): Promise<Case>;
  restoreCase(id: string): Promise<Case>;
  purgeCase(id: string): Promise<void>;

  createCharacter(caseId: string, input: CreateCharacterInput): Promise<Character>;
  listCharacters(caseId: string, options?: { includeDeleted?: boolean }): Promise<Character[]>;
  updateCharacter(id: string, input: UpdateCharacterInput): Promise<Character>;
  softDeleteCharacter(id: string): Promise<Character>;
  restoreCharacter(id: string): Promise<Character>;
  purgeCharacter(id: string): Promise<void>;

  createClue(caseId: string, input: CreateClueInput): Promise<Clue>;
  listClues(caseId: string, options?: { includeDeleted?: boolean }): Promise<Clue[]>;
  updateClue(id: string, input: UpdateClueInput): Promise<Clue>;
  softDeleteClue(id: string): Promise<Clue>;
  restoreClue(id: string): Promise<Clue>;
  purgeClue(id: string): Promise<void>;

  createEvent(caseId: string, input: CreateEventInput): Promise<Event>;
  listEvents(caseId: string, options?: { includeDeleted?: boolean }): Promise<Event[]>;
  updateEvent(id: string, input: UpdateEventInput): Promise<Event>;
  softDeleteEvent(id: string): Promise<Event>;
  restoreEvent(id: string): Promise<Event>;
  purgeEvent(id: string): Promise<void>;
  listEventCharacters(eventId: string): Promise<EventCharacter[]>;
  listEventClues(eventId: string): Promise<EventClue[]>;

  createHypothesis(caseId: string, input: CreateHypothesisInput): Promise<Hypothesis>;
  listHypotheses(caseId: string, options?: { includeDeleted?: boolean }): Promise<Hypothesis[]>;
  updateHypothesis(id: string, input: UpdateHypothesisInput): Promise<Hypothesis>;
  softDeleteHypothesis(id: string): Promise<Hypothesis>;
  restoreHypothesis(id: string): Promise<Hypothesis>;
  purgeHypothesis(id: string): Promise<void>;

  createBoardRelation(caseId: string, input: CreateBoardRelationInput): Promise<BoardRelation>;
  listBoardRelations(caseId: string, options?: { includeDeleted?: boolean }): Promise<BoardRelation[]>;
  updateBoardRelation(id: string, input: UpdateBoardRelationInput): Promise<BoardRelation>;
  softDeleteBoardRelation(id: string): Promise<BoardRelation>;
  purgeBoardRelation(id: string): Promise<void>;

  saveBoardNodePosition(
    caseId: string,
    input: SaveBoardNodePositionInput,
  ): Promise<BoardNodePosition>;
  listBoardNodePositions(caseId: string): Promise<BoardNodePosition[]>;

  listTrashEntries(): Promise<TrashEntry[]>;
  restoreTrashEntry(resourceType: TrashResourceType, resourceId: string): Promise<void>;
  purgeTrashEntry(resourceType: TrashResourceType, resourceId: string): Promise<void>;
}
