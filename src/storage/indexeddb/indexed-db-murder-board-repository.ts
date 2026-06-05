import {
  isCaseStatus,
  isIsoDateString,
  type Case,
  type CaseStatus,
  type Character,
  type Clue,
  type Event as CaseEvent,
  type EventCharacter,
  type EventClue,
  type IsoDateString,
  type RestorableCaseStatus,
  type Workspace,
} from '../../domain/types';
import type {
  ArchivedCaseListOptions,
  CaseImportInput,
  CaseImportPreview,
  CaseListOptions,
  CopyCaseInput,
  CreateCaseInput,
  CreateCharacterInput,
  CreateClueInput,
  CreateEventInput,
  CreateWorkspaceInput,
  MoveCaseInput,
  MurderBoardRepository,
  RestoreArchivedCaseInput,
  TrashEntry,
  TrashResourceType,
  UpdateCaseInput,
  UpdateCharacterInput,
  UpdateClueInput,
  UpdateEventInput,
  UpdateWorkspaceInput,
} from '../repositories';
import {
  DuplicateCaseNameError,
  DuplicateWorkspaceNameError,
  StorageNotFoundError,
  StorageStateError,
  StorageValidationError,
} from '../storage-error';
import { IndexedDbClient } from './indexed-db-client';
import type { ObjectStoreName } from './object-stores';

interface IndexedDbMurderBoardRepositoryOptions {
  client?: IndexedDbClient;
  idFactory?: () => string;
  now?: () => IsoDateString;
}

type StoredRecord =
  | Workspace
  | Case
  | Character
  | Clue
  | CaseEvent
  | EventCharacter
  | EventClue;

type IndexedDbWriteRequest = IDBRequest<IDBValidKey> | IDBRequest<undefined>;

interface NormalizedCaseImportInput {
  name: string;
  summary: string;
  status: RestorableCaseStatus;
  characters: NormalizedCaseImportCharacter[];
  clues: NormalizedCaseImportClue[];
  events: NormalizedCaseImportEvent[];
}

interface NormalizedCaseImportCharacter {
  name: string;
  role: string;
  notes: string;
}

interface NormalizedCaseImportClue {
  title: string;
  content: string;
  source: string;
  discoveredAt: IsoDateString | null;
}

interface NormalizedCaseImportEvent {
  title: string;
  description: string;
  occurredAt: IsoDateString;
  relatedCharacterNames: string[];
  relatedClueTitles: string[];
}

const REQUIRED_EVENT_STORES = [
  'events',
  'eventCharacters',
  'eventClues',
] satisfies ObjectStoreName[];

export class IndexedDbMurderBoardRepository implements MurderBoardRepository {
  private readonly client: IndexedDbClient;
  private readonly idFactory: () => string;
  private readonly now: () => IsoDateString;

  constructor(options: IndexedDbMurderBoardRepositoryOptions = {}) {
    this.client = options.client ?? new IndexedDbClient();
    this.idFactory = options.idFactory ?? defaultIdFactory;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
    const name = requireText(input.name, 'workspaceName');
    await this.assertWorkspaceNameAvailable(name);

    const timestamp = this.currentTimestamp();
    const workspace: Workspace = {
      id: this.idFactory(),
      name,
      description: normalizeOptionalText(input.description),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    try {
      await this.addRecord('workspaces', workspace);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new DuplicateWorkspaceNameError(name);
      }

      throw error;
    }

    return workspace;
  }

  async getWorkspace(
    id: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Workspace | null> {
    const workspace = await this.getRecord<Workspace>('workspaces', id);
    if (!workspace || (!options.includeDeleted && workspace.deletedAt)) {
      return null;
    }

    return workspace;
  }

  async listWorkspaces(options: { includeDeleted?: boolean } = {}): Promise<Workspace[]> {
    const workspaces = await this.getAllRecords<Workspace>('workspaces');
    return workspaces
      .filter((workspace) => options.includeDeleted || !workspace.deletedAt)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    const workspace = await this.requireWorkspace(id);
    const name = input.name === undefined ? workspace.name : requireText(input.name, 'workspaceName');

    if (name !== workspace.name) {
      await this.assertWorkspaceNameAvailable(name, workspace.id);
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      name,
      description:
        input.description === undefined
          ? workspace.description
          : normalizeOptionalText(input.description),
      updatedAt: this.currentTimestamp(),
    };

    try {
      await this.putRecord('workspaces', updatedWorkspace);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new DuplicateWorkspaceNameError(name);
      }

      throw error;
    }

    return updatedWorkspace;
  }

  async softDeleteWorkspace(id: string): Promise<Workspace> {
    const workspace = await this.requireWorkspace(id);
    if (workspace.deletedAt) {
      throw new StorageStateError('ALREADY_DELETED', `Workspace "${id}" is already deleted.`);
    }

    const timestamp = this.currentTimestamp();
    const deletedWorkspace: Workspace = {
      ...workspace,
      updatedAt: timestamp,
      deletedAt: timestamp,
    };

    await this.putRecord('workspaces', deletedWorkspace);
    return deletedWorkspace;
  }

  async restoreWorkspace(id: string): Promise<Workspace> {
    const workspace = await this.requireDeletedRecord<Workspace>('workspaces', 'Workspace', id);
    await this.assertWorkspaceNameAvailable(workspace.name, workspace.id);

    const restoredWorkspace: Workspace = {
      ...workspace,
      updatedAt: this.currentTimestamp(),
      deletedAt: null,
    };

    await this.putRecord('workspaces', restoredWorkspace);
    return restoredWorkspace;
  }

  async purgeWorkspace(id: string): Promise<void> {
    await this.requireDeletedRecord<Workspace>('workspaces', 'Workspace', id);

    const cases = await this.getAllByIndex<Case>('cases', 'workspaceId', id);
    for (const caseRecord of cases) {
      await this.purgeCaseCascade(caseRecord.id);
    }

    await this.deleteRecord('workspaces', id);
  }

  async createCase(workspaceId: string, input: CreateCaseInput): Promise<Case> {
    await this.requireWorkspace(workspaceId);

    const name = requireText(input.name, 'caseName');
    const status = input.status ?? 'draft';
    if (!isCaseStatus(status)) {
      throw new StorageValidationError(`Case status "${status}" is not supported.`, {
        status,
      });
    }

    await this.assertCaseNameAvailable(workspaceId, name);

    const timestamp = this.currentTimestamp();
    const caseRecord: Case = {
      id: this.idFactory(),
      workspaceId,
      name,
      status,
      summary: normalizeOptionalText(input.summary),
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: status === 'archived' ? timestamp : null,
      deletedAt: status === 'deleted' ? timestamp : null,
      statusBeforeDelete: status === 'deleted' ? 'draft' : null,
    };

    try {
      await this.addRecord('cases', caseRecord);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new DuplicateCaseNameError(workspaceId, name);
      }

      throw error;
    }

    return caseRecord;
  }

  async getCase(
    id: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Case | null> {
    const caseRecord = await this.getRecord<Case>('cases', id);
    if (!caseRecord || (!options.includeDeleted && caseRecord.deletedAt)) {
      return null;
    }

    return caseRecord;
  }

  async listCases(workspaceId: string, options: CaseListOptions = {}): Promise<Case[]> {
    const cases = await this.getAllByIndex<Case>('cases', 'workspaceId', workspaceId);
    return cases
      .filter((caseRecord) => options.includeDeleted || !caseRecord.deletedAt)
      .filter((caseRecord) => !options.status || caseRecord.status === options.status)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async updateCase(id: string, input: UpdateCaseInput): Promise<Case> {
    const caseRecord = await this.requireCase(id);
    const name = input.name === undefined ? caseRecord.name : requireText(input.name, 'caseName');

    if (name !== caseRecord.name) {
      await this.assertCaseNameAvailable(caseRecord.workspaceId, name, caseRecord.id);
    }

    const status = input.status ?? caseRecord.status;
    if (status === 'deleted') {
      throw new StorageValidationError('Use softDeleteCase to move a case into trash.', {
        fieldName: 'status',
        status,
      });
    }

    const timestamp = this.currentTimestamp();
    const updatedCase: Case = {
      ...caseRecord,
      name,
      summary: input.summary === undefined ? caseRecord.summary : normalizeOptionalText(input.summary),
      status,
      archivedAt: status === 'archived' ? (caseRecord.archivedAt ?? timestamp) : null,
      updatedAt: timestamp,
    };

    try {
      await this.putRecord('cases', updatedCase);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new DuplicateCaseNameError(caseRecord.workspaceId, name);
      }

      throw error;
    }

    return updatedCase;
  }

  async copyCase(id: string, input: CopyCaseInput = {}): Promise<Case> {
    const sourceCase = await this.requireCase(id);
    const targetWorkspaceId = input.targetWorkspaceId ?? sourceCase.workspaceId;
    await this.requireWorkspace(targetWorkspaceId);

    const name =
      input.name === undefined ? `Copy of ${sourceCase.name}` : requireText(input.name, 'caseName');
    const requestedStatus = input.status ?? sourceCase.status;
    if (requestedStatus === 'deleted' || !isCaseStatus(requestedStatus)) {
      throw new StorageValidationError(`Case status "${requestedStatus}" is not supported for copy.`, {
        fieldName: 'status',
        status: requestedStatus,
      });
    }

    await this.assertCaseNameAvailable(targetWorkspaceId, name);
    return this.cloneExistingCase(sourceCase, targetWorkspaceId, name, requestedStatus);
  }

  async moveCase(id: string, input: MoveCaseInput): Promise<Case> {
    const caseRecord = await this.requireCase(id);
    const targetWorkspaceId = requireText(input.targetWorkspaceId, 'targetWorkspaceId');
    await this.requireWorkspace(targetWorkspaceId);

    const name = input.name === undefined ? caseRecord.name : requireText(input.name, 'caseName');
    await this.assertCaseNameAvailable(targetWorkspaceId, name, caseRecord.id);

    const movedCase: Case = {
      ...caseRecord,
      workspaceId: targetWorkspaceId,
      name,
      updatedAt: this.currentTimestamp(),
    };

    try {
      await this.putRecord('cases', movedCase);
    } catch (error) {
      if (isConstraintError(error)) {
        throw new DuplicateCaseNameError(targetWorkspaceId, name);
      }

      throw error;
    }

    return movedCase;
  }

  async archiveCase(id: string): Promise<Case> {
    const caseRecord = await this.requireCase(id);
    if (caseRecord.status === 'archived') {
      return caseRecord;
    }

    return this.updateCase(id, { status: 'archived' });
  }

  async listArchivedCases(options: ArchivedCaseListOptions = {}): Promise<Case[]> {
    const [cases, workspaces] = await Promise.all([
      this.getAllRecords<Case>('cases'),
      this.getAllRecords<Workspace>('workspaces'),
    ]);
    const activeWorkspaceIds = new Set(
      workspaces.filter((workspace) => !workspace.deletedAt).map((workspace) => workspace.id),
    );

    return cases
      .filter((caseRecord) => caseRecord.status === 'archived')
      .filter((caseRecord) => !caseRecord.deletedAt)
      .filter((caseRecord) => activeWorkspaceIds.has(caseRecord.workspaceId))
      .filter((caseRecord) => !options.workspaceId || caseRecord.workspaceId === options.workspaceId)
      .sort((left, right) =>
        (right.archivedAt ?? right.updatedAt).localeCompare(left.archivedAt ?? left.updatedAt),
      );
  }

  async restoreArchivedCase(
    id: string,
    input: RestoreArchivedCaseInput = {},
  ): Promise<Case> {
    const sourceCase = await this.requireCase(id);
    if (sourceCase.status !== 'archived') {
      throw new StorageStateError('CONFLICT', `Case "${id}" is not archived.`);
    }

    const targetWorkspaceId = input.targetWorkspaceId ?? sourceCase.workspaceId;
    await this.requireWorkspace(targetWorkspaceId);
    const name = input.name === undefined ? sourceCase.name : requireText(input.name, 'caseName');
    await this.assertCaseNameAvailable(targetWorkspaceId, name);

    return this.cloneExistingCase(sourceCase, targetWorkspaceId, name, 'active');
  }

  async previewCaseImport(
    workspaceId: string,
    input: CaseImportInput,
  ): Promise<CaseImportPreview> {
    await this.requireWorkspace(workspaceId);
    const draft = normalizeCaseImportInput(input);
    const existing = await this.getByIndex<Case>('cases', 'workspaceIdName', [
      workspaceId,
      draft.name,
    ]);
    const conflicts: CaseImportPreview['conflicts'] = [
      ...(existing
        ? [
            {
              fieldName: 'caseName',
              message: `Case name "${draft.name}" already exists in the selected workspace.`,
              value: draft.name,
            },
          ]
        : []),
      ...getAmbiguousImportRelationConflicts(draft),
    ];

    return {
      targetWorkspaceId: workspaceId,
      name: draft.name,
      canImport: conflicts.length === 0,
      conflicts,
      counts: {
        characters: draft.characters.length,
        clues: draft.clues.length,
        events: draft.events.length,
      },
    };
  }

  async importCaseDraft(workspaceId: string, input: CaseImportInput): Promise<Case> {
    await this.requireWorkspace(workspaceId);
    const draft = normalizeCaseImportInput(input);
    await this.assertCaseNameAvailable(workspaceId, draft.name);
    assertImportRelationsAreUnambiguous(draft);

    const timestamp = this.currentTimestamp();
    const importedCase: Case = {
      id: this.idFactory(),
      workspaceId,
      name: draft.name,
      status: draft.status,
      summary: draft.summary,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: draft.status === 'archived' ? timestamp : null,
      deletedAt: null,
      statusBeforeDelete: null,
    };
    const characterIdByName = new Map<string, string>();
    const clueIdByTitle = new Map<string, string>();
    const importedCharacters = draft.characters.map<Character>((character) => {
      const id = this.idFactory();
      characterIdByName.set(character.name, id);
      return {
        id,
        caseId: importedCase.id,
        name: character.name,
        role: character.role,
        notes: character.notes,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
    });
    const importedClues = draft.clues.map<Clue>((clue) => {
      const id = this.idFactory();
      clueIdByTitle.set(clue.title, id);
      return {
        id,
        caseId: importedCase.id,
        title: clue.title,
        content: clue.content,
        source: clue.source,
        discoveredAt: clue.discoveredAt,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
    });
    const importedEvents = draft.events.map<CaseEvent>((event) => ({
      id: this.idFactory(),
      caseId: importedCase.id,
      title: event.title,
      description: event.description,
      occurredAt: event.occurredAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    }));
    const importedEventCharacters = draft.events.flatMap<EventCharacter>((event, index) => {
      const eventId = importedEvents[index].id;
      return uniqueValues(event.relatedCharacterNames).map((characterName) => {
        const characterId = characterIdByName.get(characterName);
        if (!characterId) {
          throw new StorageValidationError(
            `Imported event "${event.title}" references unknown character "${characterName}".`,
            { fieldName: 'relatedCharacterNames', characterName },
          );
        }

        return {
          id: `${eventId}:${characterId}`,
          eventId,
          characterId,
        };
      });
    });
    const importedEventClues = draft.events.flatMap<EventClue>((event, index) => {
      const eventId = importedEvents[index].id;
      return uniqueValues(event.relatedClueTitles).map((clueTitle) => {
        const clueId = clueIdByTitle.get(clueTitle);
        if (!clueId) {
          throw new StorageValidationError(
            `Imported event "${event.title}" references unknown clue "${clueTitle}".`,
            { fieldName: 'relatedClueTitles', clueTitle },
          );
        }

        return {
          id: `${eventId}:${clueId}`,
          eventId,
          clueId,
        };
      });
    });

    await this.addCaseSnapshot(
      importedCase,
      importedCharacters,
      importedClues,
      importedEvents,
      importedEventCharacters,
      importedEventClues,
    );
    return importedCase;
  }

  async softDeleteCase(id: string): Promise<Case> {
    const caseRecord = await this.getCase(id, { includeDeleted: true });
    if (!caseRecord) {
      throw new StorageNotFoundError('Case', id);
    }

    if (caseRecord.deletedAt) {
      throw new StorageStateError('ALREADY_DELETED', `Case "${id}" is already deleted.`);
    }

    const timestamp = this.currentTimestamp();
    const deletedCase: Case = {
      ...caseRecord,
      status: 'deleted',
      statusBeforeDelete: caseRecord.status as RestorableCaseStatus,
      updatedAt: timestamp,
      deletedAt: timestamp,
    };

    await this.putRecord('cases', deletedCase);
    return deletedCase;
  }

  async restoreCase(id: string): Promise<Case> {
    const caseRecord = await this.requireDeletedRecord<Case>('cases', 'Case', id);
    await this.requireWorkspace(caseRecord.workspaceId);
    await this.assertCaseNameAvailable(caseRecord.workspaceId, caseRecord.name, caseRecord.id);

    const restoredStatus = caseRecord.statusBeforeDelete ?? 'draft';
    const restoredCase: Case = {
      ...caseRecord,
      status: restoredStatus,
      updatedAt: this.currentTimestamp(),
      deletedAt: null,
      statusBeforeDelete: null,
    };

    await this.putRecord('cases', restoredCase);
    return restoredCase;
  }

  async purgeCase(id: string): Promise<void> {
    await this.requireDeletedRecord<Case>('cases', 'Case', id);
    await this.purgeCaseCascade(id);
  }

  async createCharacter(caseId: string, input: CreateCharacterInput): Promise<Character> {
    await this.requireCase(caseId);

    const timestamp = this.currentTimestamp();
    const character: Character = {
      id: this.idFactory(),
      caseId,
      name: requireText(input.name, 'characterName'),
      role: normalizeOptionalText(input.role),
      notes: normalizeOptionalText(input.notes),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await this.addRecord('characters', character);
    return character;
  }

  async listCharacters(
    caseId: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Character[]> {
    const characters = await this.getAllByIndex<Character>('characters', 'caseId', caseId);
    return characters
      .filter((character) => options.includeDeleted || !character.deletedAt)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async updateCharacter(id: string, input: UpdateCharacterInput): Promise<Character> {
    const character = await this.requireCharacterById(id);
    const updatedCharacter: Character = {
      ...character,
      name: input.name === undefined ? character.name : requireText(input.name, 'characterName'),
      role: input.role === undefined ? character.role : normalizeOptionalText(input.role),
      notes: input.notes === undefined ? character.notes : normalizeOptionalText(input.notes),
      updatedAt: this.currentTimestamp(),
    };

    await this.putRecord('characters', updatedCharacter);
    return updatedCharacter;
  }

  async softDeleteCharacter(id: string): Promise<Character> {
    const character = await this.requireCharacterById(id);
    const timestamp = this.currentTimestamp();
    const deletedCharacter: Character = {
      ...character,
      updatedAt: timestamp,
      deletedAt: timestamp,
    };

    await this.putRecord('characters', deletedCharacter);
    return deletedCharacter;
  }

  async restoreCharacter(id: string): Promise<Character> {
    const character = await this.requireDeletedRecord<Character>('characters', 'Character', id);
    await this.requireCase(character.caseId);

    const restoredCharacter: Character = {
      ...character,
      updatedAt: this.currentTimestamp(),
      deletedAt: null,
    };

    await this.putRecord('characters', restoredCharacter);
    return restoredCharacter;
  }

  async purgeCharacter(id: string): Promise<void> {
    await this.requireDeletedRecord<Character>('characters', 'Character', id);
    await this.deleteCharacterCascade(id);
  }

  async createClue(caseId: string, input: CreateClueInput): Promise<Clue> {
    await this.requireCase(caseId);

    const discoveredAt = input.discoveredAt
      ? requireIsoDate(input.discoveredAt, 'discoveredAt')
      : null;
    const timestamp = this.currentTimestamp();
    const clue: Clue = {
      id: this.idFactory(),
      caseId,
      title: requireText(input.title, 'clueTitle'),
      content: normalizeOptionalText(input.content),
      source: normalizeOptionalText(input.source),
      discoveredAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };

    await this.addRecord('clues', clue);
    return clue;
  }

  async listClues(
    caseId: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Clue[]> {
    const clues = await this.getAllByIndex<Clue>('clues', 'caseId', caseId);
    return clues
      .filter((clue) => options.includeDeleted || !clue.deletedAt)
      .sort((left, right) => left.title.localeCompare(right.title));
  }

  async updateClue(id: string, input: UpdateClueInput): Promise<Clue> {
    const clue = await this.requireClueById(id);
    const discoveredAt =
      input.discoveredAt === undefined
        ? clue.discoveredAt
        : input.discoveredAt
          ? requireIsoDate(input.discoveredAt, 'discoveredAt')
          : null;
    const updatedClue: Clue = {
      ...clue,
      title: input.title === undefined ? clue.title : requireText(input.title, 'clueTitle'),
      content: input.content === undefined ? clue.content : normalizeOptionalText(input.content),
      source: input.source === undefined ? clue.source : normalizeOptionalText(input.source),
      discoveredAt,
      updatedAt: this.currentTimestamp(),
    };

    await this.putRecord('clues', updatedClue);
    return updatedClue;
  }

  async softDeleteClue(id: string): Promise<Clue> {
    const clue = await this.requireClueById(id);
    const timestamp = this.currentTimestamp();
    const deletedClue: Clue = {
      ...clue,
      updatedAt: timestamp,
      deletedAt: timestamp,
    };

    await this.putRecord('clues', deletedClue);
    return deletedClue;
  }

  async restoreClue(id: string): Promise<Clue> {
    const clue = await this.requireDeletedRecord<Clue>('clues', 'Clue', id);
    await this.requireCase(clue.caseId);

    const restoredClue: Clue = {
      ...clue,
      updatedAt: this.currentTimestamp(),
      deletedAt: null,
    };

    await this.putRecord('clues', restoredClue);
    return restoredClue;
  }

  async purgeClue(id: string): Promise<void> {
    await this.requireDeletedRecord<Clue>('clues', 'Clue', id);
    await this.deleteClueCascade(id);
  }

  async createEvent(caseId: string, input: CreateEventInput): Promise<CaseEvent> {
    await this.requireCase(caseId);

    const relatedCharacterIds = uniqueValues(input.relatedCharacterIds ?? []);
    const relatedClueIds = uniqueValues(input.relatedClueIds ?? []);
    await Promise.all([
      ...relatedCharacterIds.map((characterId) => this.requireCharacter(characterId, caseId)),
      ...relatedClueIds.map((clueId) => this.requireClue(clueId, caseId)),
    ]);

    const timestamp = this.currentTimestamp();
    const event: CaseEvent = {
      id: this.idFactory(),
      caseId,
      title: requireText(input.title, 'eventTitle'),
      description: normalizeOptionalText(input.description),
      occurredAt: requireIsoDate(input.occurredAt, 'occurredAt'),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    const eventCharacters = relatedCharacterIds.map<EventCharacter>((characterId) => ({
      id: `${event.id}:${characterId}`,
      eventId: event.id,
      characterId,
    }));
    const eventClues = relatedClueIds.map<EventClue>((clueId) => ({
      id: `${event.id}:${clueId}`,
      eventId: event.id,
      clueId,
    }));

    await this.addEventWithRelations(event, eventCharacters, eventClues);
    return event;
  }

  async listEvents(
    caseId: string,
    options: { includeDeleted?: boolean } = {},
  ): Promise<CaseEvent[]> {
    const events = await this.getAllByIndex<CaseEvent>('events', 'caseId', caseId);
    return events
      .filter((event) => options.includeDeleted || !event.deletedAt)
      .sort((left, right) => {
        const occurrenceOrder = Date.parse(left.occurredAt) - Date.parse(right.occurredAt);
        if (occurrenceOrder !== 0) {
          return occurrenceOrder;
        }

        const createdOrder = left.createdAt.localeCompare(right.createdAt);
        if (createdOrder !== 0) {
          return createdOrder;
        }

        return left.id.localeCompare(right.id);
      });
  }

  async updateEvent(id: string, input: UpdateEventInput): Promise<CaseEvent> {
    const event = await this.requireEventById(id);
    const relatedCharacterIds =
      input.relatedCharacterIds === undefined ? null : uniqueValues(input.relatedCharacterIds);
    const relatedClueIds = input.relatedClueIds === undefined ? null : uniqueValues(input.relatedClueIds);
    const shouldReplaceRelations = relatedCharacterIds !== null || relatedClueIds !== null;
    const [existingCharacterRelations, existingClueRelations] = shouldReplaceRelations
      ? await Promise.all([this.listEventCharacters(event.id), this.listEventClues(event.id)])
      : [[], []];
    const existingCharacterIds = new Set(
      existingCharacterRelations.map((relation) => relation.characterId),
    );
    const existingClueIds = new Set(existingClueRelations.map((relation) => relation.clueId));

    await Promise.all([
      ...(relatedCharacterIds ?? [])
        .filter((characterId) => !existingCharacterIds.has(characterId))
        .map((characterId) => this.requireCharacter(characterId, event.caseId)),
      ...(relatedClueIds ?? [])
        .filter((clueId) => !existingClueIds.has(clueId))
        .map((clueId) => this.requireClue(clueId, event.caseId)),
    ]);

    const updatedEvent: CaseEvent = {
      ...event,
      title: input.title === undefined ? event.title : requireText(input.title, 'eventTitle'),
      description:
        input.description === undefined
          ? event.description
          : normalizeOptionalText(input.description),
      occurredAt:
        input.occurredAt === undefined ? event.occurredAt : requireIsoDate(input.occurredAt, 'occurredAt'),
      updatedAt: this.currentTimestamp(),
    };

    if (relatedCharacterIds === null && relatedClueIds === null) {
      await this.putRecord('events', updatedEvent);
      return updatedEvent;
    }

    const nextCharacterIds =
      relatedCharacterIds ?? existingCharacterRelations.map((relation) => relation.characterId);
    const nextClueIds = relatedClueIds ?? existingClueRelations.map((relation) => relation.clueId);
    const eventCharacters = nextCharacterIds.map<EventCharacter>((characterId) => ({
      id: `${event.id}:${characterId}`,
      eventId: event.id,
      characterId,
    }));
    const eventClues = nextClueIds.map<EventClue>((clueId) => ({
      id: `${event.id}:${clueId}`,
      eventId: event.id,
      clueId,
    }));

    await this.replaceEventWithRelations(updatedEvent, eventCharacters, eventClues);
    return updatedEvent;
  }

  async softDeleteEvent(id: string): Promise<CaseEvent> {
    const event = await this.requireEventById(id);
    const timestamp = this.currentTimestamp();
    const deletedEvent: CaseEvent = {
      ...event,
      updatedAt: timestamp,
      deletedAt: timestamp,
    };

    await this.putRecord('events', deletedEvent);
    return deletedEvent;
  }

  async restoreEvent(id: string): Promise<CaseEvent> {
    const event = await this.requireDeletedRecord<CaseEvent>('events', 'Event', id);
    await this.requireCase(event.caseId);

    const restoredEvent: CaseEvent = {
      ...event,
      updatedAt: this.currentTimestamp(),
      deletedAt: null,
    };

    await this.putRecord('events', restoredEvent);
    return restoredEvent;
  }

  async purgeEvent(id: string): Promise<void> {
    await this.requireDeletedRecord<CaseEvent>('events', 'Event', id);
    await this.deleteEventCascade(id);
  }

  async listEventCharacters(eventId: string): Promise<EventCharacter[]> {
    return this.getAllByIndex<EventCharacter>('eventCharacters', 'eventId', eventId);
  }

  async listEventClues(eventId: string): Promise<EventClue[]> {
    return this.getAllByIndex<EventClue>('eventClues', 'eventId', eventId);
  }

  async listTrashEntries(): Promise<TrashEntry[]> {
    const [workspaces, cases, characters, clues, events] = await Promise.all([
      this.getAllRecords<Workspace>('workspaces'),
      this.getAllRecords<Case>('cases'),
      this.getAllRecords<Character>('characters'),
      this.getAllRecords<Clue>('clues'),
      this.getAllRecords<CaseEvent>('events'),
    ]);
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    const caseById = new Map(cases.map((caseRecord) => [caseRecord.id, caseRecord]));
    const trashEntries: TrashEntry[] = [
      ...workspaces
        .filter((workspace) => workspace.deletedAt)
        .map((workspace) =>
          toTrashEntry('workspace', workspace.id, workspace.name, '', workspace.deletedAt),
        ),
      ...cases
        .filter((caseRecord) => caseRecord.deletedAt)
        .map((caseRecord) =>
          toTrashEntry(
            'case',
            caseRecord.id,
            caseRecord.name,
            workspaceById.get(caseRecord.workspaceId)?.name ?? '',
            caseRecord.deletedAt,
          ),
        ),
      ...characters
        .filter((character) => character.deletedAt)
        .map((character) =>
          toTrashEntry(
            'character',
            character.id,
            character.name,
            caseById.get(character.caseId)?.name ?? '',
            character.deletedAt,
          ),
        ),
      ...clues
        .filter((clue) => clue.deletedAt)
        .map((clue) =>
          toTrashEntry(
            'clue',
            clue.id,
            clue.title,
            caseById.get(clue.caseId)?.name ?? '',
            clue.deletedAt,
          ),
        ),
      ...events
        .filter((event) => event.deletedAt)
        .map((event) =>
          toTrashEntry(
            'event',
            event.id,
            event.title,
            caseById.get(event.caseId)?.name ?? '',
            event.deletedAt,
          ),
        ),
    ];

    return trashEntries.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
  }

  async restoreTrashEntry(resourceType: TrashResourceType, resourceId: string): Promise<void> {
    switch (resourceType) {
      case 'workspace':
        await this.restoreWorkspace(resourceId);
        return;
      case 'case':
        await this.restoreCase(resourceId);
        return;
      case 'character':
        await this.restoreCharacter(resourceId);
        return;
      case 'clue':
        await this.restoreClue(resourceId);
        return;
      case 'event':
        await this.restoreEvent(resourceId);
        return;
    }
  }

  async purgeTrashEntry(resourceType: TrashResourceType, resourceId: string): Promise<void> {
    switch (resourceType) {
      case 'workspace':
        await this.purgeWorkspace(resourceId);
        return;
      case 'case':
        await this.purgeCase(resourceId);
        return;
      case 'character':
        await this.purgeCharacter(resourceId);
        return;
      case 'clue':
        await this.purgeClue(resourceId);
        return;
      case 'event':
        await this.purgeEvent(resourceId);
        return;
    }
  }

  private async requireDeletedRecord<
    TRecord extends StoredRecord & { deletedAt: IsoDateString | null },
  >(storeName: ObjectStoreName, resourceType: string, id: string): Promise<TRecord> {
    const record = await this.getRecord<TRecord>(storeName, id);
    if (!record) {
      throw new StorageNotFoundError(resourceType, id);
    }

    if (!record.deletedAt) {
      throw new StorageStateError('NOT_DELETED', `${resourceType} "${id}" is not in trash.`);
    }

    return record;
  }

  private async requireWorkspace(id: string): Promise<Workspace> {
    const workspace = await this.getWorkspace(id, { includeDeleted: true });
    if (!workspace || workspace.deletedAt) {
      throw new StorageNotFoundError('Workspace', id);
    }

    return workspace;
  }

  private async requireCase(id: string): Promise<Case> {
    const caseRecord = await this.getCase(id, { includeDeleted: true });
    if (!caseRecord || caseRecord.deletedAt) {
      throw new StorageNotFoundError('Case', id);
    }

    return caseRecord;
  }

  private async requireCharacterById(id: string): Promise<Character> {
    const character = await this.getRecord<Character>('characters', id);
    if (!character || character.deletedAt) {
      throw new StorageNotFoundError('Character', id);
    }

    return character;
  }

  private async requireCharacter(id: string, caseId: string): Promise<Character> {
    const character = await this.requireCharacterById(id);
    if (character.caseId !== caseId) {
      throw new StorageNotFoundError('Character', id);
    }

    return character;
  }

  private async requireClueById(id: string): Promise<Clue> {
    const clue = await this.getRecord<Clue>('clues', id);
    if (!clue || clue.deletedAt) {
      throw new StorageNotFoundError('Clue', id);
    }

    return clue;
  }

  private async requireClue(id: string, caseId: string): Promise<Clue> {
    const clue = await this.requireClueById(id);
    if (clue.caseId !== caseId) {
      throw new StorageNotFoundError('Clue', id);
    }

    return clue;
  }

  private async requireEventById(id: string): Promise<CaseEvent> {
    const event = await this.getRecord<CaseEvent>('events', id);
    if (!event || event.deletedAt) {
      throw new StorageNotFoundError('Event', id);
    }

    return event;
  }

  private async assertWorkspaceNameAvailable(name: string, exceptId?: string) {
    const existing = await this.getByIndex<Workspace>('workspaces', 'name', name);
    if (existing && existing.id !== exceptId) {
      throw new DuplicateWorkspaceNameError(name);
    }
  }

  private async assertCaseNameAvailable(workspaceId: string, name: string, exceptId?: string) {
    const existing = await this.getByIndex<Case>('cases', 'workspaceIdName', [
      workspaceId,
      name,
    ]);
    if (existing && existing.id !== exceptId) {
      throw new DuplicateCaseNameError(workspaceId, name);
    }
  }

  private currentTimestamp(): IsoDateString {
    return requireIsoDate(this.now(), 'now');
  }

  private async getRecord<TRecord extends StoredRecord>(
    storeName: ObjectStoreName,
    id: string,
  ): Promise<TRecord | null> {
    const db = await this.client.init();
    const result = await readFromStore<TRecord | undefined>(db, storeName, (store) =>
      store.get(id),
    );
    return result ?? null;
  }

  private async getByIndex<TRecord extends StoredRecord>(
    storeName: ObjectStoreName,
    indexName: string,
    query: IDBValidKey | IDBKeyRange,
  ): Promise<TRecord | null> {
    const db = await this.client.init();
    const result = await readFromStore<TRecord | undefined>(db, storeName, (store) =>
      store.index(indexName).get(query),
    );
    return result ?? null;
  }

  private async getAllRecords<TRecord extends StoredRecord>(
    storeName: ObjectStoreName,
  ): Promise<TRecord[]> {
    const db = await this.client.init();
    return readFromStore<TRecord[]>(db, storeName, (store) => store.getAll());
  }

  private async getAllByIndex<TRecord extends StoredRecord>(
    storeName: ObjectStoreName,
    indexName: string,
    query: IDBValidKey | IDBKeyRange,
  ): Promise<TRecord[]> {
    const db = await this.client.init();
    return readFromStore<TRecord[]>(db, storeName, (store) => store.index(indexName).getAll(query));
  }

  private async addRecord(storeName: ObjectStoreName, record: StoredRecord) {
    const db = await this.client.init();
    await writeToStore(db, [storeName], (transaction) =>
      transaction.objectStore(storeName).add(record),
    );
  }

  private async putRecord(storeName: ObjectStoreName, record: StoredRecord) {
    const db = await this.client.init();
    await writeToStore(db, [storeName], (transaction) =>
      transaction.objectStore(storeName).put(record),
    );
  }

  private async deleteRecord(storeName: ObjectStoreName, id: string) {
    const db = await this.client.init();
    await writeToStore(db, [storeName], (transaction) =>
      transaction.objectStore(storeName).delete(id),
    );
  }

  private async purgeCaseCascade(id: string) {
    const [characters, clues, events] = await Promise.all([
      this.getAllByIndex<Character>('characters', 'caseId', id),
      this.getAllByIndex<Clue>('clues', 'caseId', id),
      this.getAllByIndex<CaseEvent>('events', 'caseId', id),
    ]);

    for (const event of events) {
      await this.deleteEventCascade(event.id);
    }
    for (const character of characters) {
      await this.deleteCharacterCascade(character.id);
    }
    for (const clue of clues) {
      await this.deleteClueCascade(clue.id);
    }

    await this.deleteRecord('cases', id);
  }

  private async deleteCharacterCascade(id: string) {
    const relations = await this.getAllByIndex<EventCharacter>('eventCharacters', 'characterId', id);
    const db = await this.client.init();
    await writeToStore(db, ['characters', 'eventCharacters'], (transaction) => [
      transaction.objectStore('characters').delete(id),
      ...relations.map((relation) =>
        transaction.objectStore('eventCharacters').delete(relation.id),
      ),
    ]);
  }

  private async deleteClueCascade(id: string) {
    const relations = await this.getAllByIndex<EventClue>('eventClues', 'clueId', id);
    const db = await this.client.init();
    await writeToStore(db, ['clues', 'eventClues'], (transaction) => [
      transaction.objectStore('clues').delete(id),
      ...relations.map((relation) => transaction.objectStore('eventClues').delete(relation.id)),
    ]);
  }

  private async deleteEventCascade(id: string) {
    const [eventCharacters, eventClues] = await Promise.all([
      this.listEventCharacters(id),
      this.listEventClues(id),
    ]);
    const db = await this.client.init();
    await writeToStore(db, REQUIRED_EVENT_STORES, (transaction) => [
      transaction.objectStore('events').delete(id),
      ...eventCharacters.map((relation) =>
        transaction.objectStore('eventCharacters').delete(relation.id),
      ),
      ...eventClues.map((relation) => transaction.objectStore('eventClues').delete(relation.id)),
    ]);
  }

  private async addEventWithRelations(
    event: CaseEvent,
    eventCharacters: EventCharacter[],
    eventClues: EventClue[],
  ) {
    const db = await this.client.init();
    await writeToStore(db, REQUIRED_EVENT_STORES, (transaction) => {
      const requests: IndexedDbWriteRequest[] = [
        transaction.objectStore('events').add(event),
        ...eventCharacters.map((eventCharacter) =>
          transaction.objectStore('eventCharacters').add(eventCharacter),
        ),
        ...eventClues.map((eventClue) => transaction.objectStore('eventClues').add(eventClue)),
      ];

      return requests;
    });
  }

  private async replaceEventWithRelations(
    event: CaseEvent,
    eventCharacters: EventCharacter[],
    eventClues: EventClue[],
  ) {
    const db = await this.client.init();
    const existingCharacters = await this.listEventCharacters(event.id);
    const existingClues = await this.listEventClues(event.id);

    await writeToStore(db, REQUIRED_EVENT_STORES, (transaction) => {
      const requests: IndexedDbWriteRequest[] = [
        transaction.objectStore('events').put(event),
        ...existingCharacters.map((relation) =>
          transaction.objectStore('eventCharacters').delete(relation.id),
        ),
        ...existingClues.map((relation) => transaction.objectStore('eventClues').delete(relation.id)),
        ...eventCharacters.map((relation) =>
          transaction.objectStore('eventCharacters').add(relation),
        ),
        ...eventClues.map((relation) => transaction.objectStore('eventClues').add(relation)),
      ];

      return requests;
    });
  }

  private async cloneExistingCase(
    sourceCase: Case,
    targetWorkspaceId: string,
    name: string,
    status: RestorableCaseStatus,
  ) {
    const timestamp = this.currentTimestamp();
    const clonedCase: Case = {
      ...sourceCase,
      id: this.idFactory(),
      workspaceId: targetWorkspaceId,
      name,
      status,
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: status === 'archived' ? timestamp : null,
      deletedAt: null,
      statusBeforeDelete: null,
    };
    const sourceCharacters = await this.listCharacters(sourceCase.id);
    const sourceClues = await this.listClues(sourceCase.id);
    const sourceEvents = await this.listEvents(sourceCase.id);
    const characterIdMap = new Map<string, string>();
    const clueIdMap = new Map<string, string>();
    const eventIdMap = new Map<string, string>();
    const clonedCharacters = sourceCharacters.map<Character>((character) => {
      const newId = this.idFactory();
      characterIdMap.set(character.id, newId);
      return {
        ...character,
        id: newId,
        caseId: clonedCase.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
    });
    const clonedClues = sourceClues.map<Clue>((clue) => {
      const newId = this.idFactory();
      clueIdMap.set(clue.id, newId);
      return {
        ...clue,
        id: newId,
        caseId: clonedCase.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
    });
    const clonedEvents = sourceEvents.map<CaseEvent>((event) => {
      const newId = this.idFactory();
      eventIdMap.set(event.id, newId);
      return {
        ...event,
        id: newId,
        caseId: clonedCase.id,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
    });
    const relationPairs = await Promise.all(
      sourceEvents.map(async (event) => {
        const [eventCharacters, eventClues] = await Promise.all([
          this.listEventCharacters(event.id),
          this.listEventClues(event.id),
        ]);
        return { event, eventCharacters, eventClues };
      }),
    );
    const clonedEventCharacters = relationPairs.flatMap<EventCharacter>(
      ({ event, eventCharacters }) => {
        const clonedEventId = eventIdMap.get(event.id);
        if (!clonedEventId) {
          return [];
        }

        return eventCharacters.flatMap<EventCharacter>((relation) => {
          const clonedCharacterId = characterIdMap.get(relation.characterId);
          if (!clonedCharacterId) {
            return [];
          }

          return [
            {
              id: `${clonedEventId}:${clonedCharacterId}`,
              eventId: clonedEventId,
              characterId: clonedCharacterId,
            },
          ];
        });
      },
    );
    const clonedEventClues = relationPairs.flatMap<EventClue>(({ event, eventClues }) => {
      const clonedEventId = eventIdMap.get(event.id);
      if (!clonedEventId) {
        return [];
      }

      return eventClues.flatMap<EventClue>((relation) => {
        const clonedClueId = clueIdMap.get(relation.clueId);
        if (!clonedClueId) {
          return [];
        }

        return [
          {
            id: `${clonedEventId}:${clonedClueId}`,
            eventId: clonedEventId,
            clueId: clonedClueId,
          },
        ];
      });
    });

    await this.addCaseSnapshot(
      clonedCase,
      clonedCharacters,
      clonedClues,
      clonedEvents,
      clonedEventCharacters,
      clonedEventClues,
    );
    return clonedCase;
  }

  private async addCaseSnapshot(
    caseRecord: Case,
    characters: Character[],
    clues: Clue[],
    events: CaseEvent[],
    eventCharacters: EventCharacter[],
    eventClues: EventClue[],
  ) {
    const db = await this.client.init();
    await writeToStore(
      db,
      ['cases', 'characters', 'clues', 'events', 'eventCharacters', 'eventClues'],
      (transaction) => [
        transaction.objectStore('cases').add(caseRecord),
        ...characters.map((character) => transaction.objectStore('characters').add(character)),
        ...clues.map((clue) => transaction.objectStore('clues').add(clue)),
        ...events.map((event) => transaction.objectStore('events').add(event)),
        ...eventCharacters.map((relation) =>
          transaction.objectStore('eventCharacters').add(relation),
        ),
        ...eventClues.map((relation) => transaction.objectStore('eventClues').add(relation)),
      ],
    );
  }
}

function defaultIdFactory() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() ?? '';
}

function requireText(value: string, fieldName: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new StorageValidationError(`${fieldName} is required.`, {
      fieldName,
    });
  }

  return trimmed;
}

function requireIsoDate(value: string, fieldName: string): IsoDateString {
  if (!isIsoDateString(value)) {
    throw new StorageValidationError(`${fieldName} must be a structured ISO DateTime.`, {
      fieldName,
      value,
    });
  }

  return value;
}

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}

function getAmbiguousImportRelationConflicts(
  draft: NormalizedCaseImportInput,
): CaseImportPreview['conflicts'] {
  return [
    ...findDuplicateValues(draft.characters.map((character) => character.name)).map((name) => ({
      fieldName: 'characters.name',
      message: `Character name "${name}" appears more than once in the import payload.`,
      value: name,
    })),
    ...findDuplicateValues(draft.clues.map((clue) => clue.title)).map((title) => ({
      fieldName: 'clues.title',
      message: `Clue title "${title}" appears more than once in the import payload.`,
      value: title,
    })),
  ];
}

function assertImportRelationsAreUnambiguous(draft: NormalizedCaseImportInput) {
  const conflicts = getAmbiguousImportRelationConflicts(draft);
  if (conflicts.length > 0) {
    throw new StorageValidationError(
      'Imported case contains duplicate character names or clue titles, so event relations are ambiguous.',
      Object.fromEntries(
        conflicts.map((conflict, index) => [
          `conflicts[${index}]`,
          `${conflict.fieldName}:${conflict.value}`,
        ]),
      ),
    );
  }
}

function findDuplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  }

  return [...duplicates];
}

function normalizeCaseImportInput(input: CaseImportInput): NormalizedCaseImportInput {
  const raw = requirePlainObject(input, 'caseImport');
  const status = normalizeImportStatus(raw.status);
  return {
    name: requireTextFromUnknown(raw.name, 'caseName'),
    summary: normalizeTextFromUnknown(raw.summary, 'summary'),
    status,
    characters: normalizeObjectArray(raw.characters, 'characters').map((character, index) => ({
      name: requireTextFromUnknown(character.name, `characters[${index}].name`),
      role: normalizeTextFromUnknown(character.role, `characters[${index}].role`),
      notes: normalizeTextFromUnknown(character.notes, `characters[${index}].notes`),
    })),
    clues: normalizeObjectArray(raw.clues, 'clues').map((clue, index) => ({
      title: requireTextFromUnknown(clue.title, `clues[${index}].title`),
      content: normalizeTextFromUnknown(clue.content, `clues[${index}].content`),
      source: normalizeTextFromUnknown(clue.source, `clues[${index}].source`),
      discoveredAt: normalizeOptionalIsoDate(clue.discoveredAt, `clues[${index}].discoveredAt`),
    })),
    events: normalizeObjectArray(raw.events, 'events').map((event, index) => ({
      title: requireTextFromUnknown(event.title, `events[${index}].title`),
      description: normalizeTextFromUnknown(event.description, `events[${index}].description`),
      occurredAt: requireIsoDateFromUnknown(event.occurredAt, `events[${index}].occurredAt`),
      relatedCharacterNames: normalizeStringArray(
        event.relatedCharacterNames,
        `events[${index}].relatedCharacterNames`,
      ),
      relatedClueTitles: normalizeStringArray(
        event.relatedClueTitles,
        `events[${index}].relatedClueTitles`,
      ),
    })),
  };
}

function requirePlainObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new StorageValidationError(`${fieldName} must be an object.`, { fieldName });
  }

  return value as Record<string, unknown>;
}

function normalizeObjectArray(value: unknown, fieldName: string) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new StorageValidationError(`${fieldName} must be an array.`, { fieldName });
  }

  return value.map((item, index) => requirePlainObject(item, `${fieldName}[${index}]`));
}

function normalizeImportStatus(value: unknown): RestorableCaseStatus {
  if (value === undefined) {
    return 'active';
  }
  if (typeof value !== 'string' || !isCaseStatus(value) || value === 'deleted') {
    throw new StorageValidationError(`Case status "${String(value)}" is not supported.`, {
      fieldName: 'status',
      status: String(value),
    });
  }

  return value;
}

function requireTextFromUnknown(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new StorageValidationError(`${fieldName} must be text.`, { fieldName });
  }

  return requireText(value, fieldName);
}

function normalizeTextFromUnknown(value: unknown, fieldName: string) {
  if (value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new StorageValidationError(`${fieldName} must be text.`, { fieldName });
  }

  return normalizeOptionalText(value);
}

function requireIsoDateFromUnknown(value: unknown, fieldName: string) {
  if (typeof value !== 'string') {
    throw new StorageValidationError(`${fieldName} must be a structured ISO DateTime.`, {
      fieldName,
      value: String(value),
    });
  }

  return requireIsoDate(value, fieldName);
}

function normalizeOptionalIsoDate(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return requireIsoDateFromUnknown(value, fieldName);
}

function normalizeStringArray(value: unknown, fieldName: string) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new StorageValidationError(`${fieldName} must be an array.`, { fieldName });
  }

  return value.map((item, index) => requireTextFromUnknown(item, `${fieldName}[${index}]`));
}

function toTrashEntry(
  resourceType: TrashResourceType,
  resourceId: string,
  label: string,
  parentLabel: string,
  deletedAt: IsoDateString | null,
): TrashEntry {
  if (!deletedAt) {
    throw new StorageStateError('NOT_DELETED', `${resourceType} "${resourceId}" is not in trash.`);
  }

  return {
    id: `${resourceType}:${resourceId}`,
    resourceId,
    resourceType,
    label,
    parentLabel,
    deletedAt,
  };
}

function isConstraintError(error: unknown) {
  return error instanceof DOMException && error.name === 'ConstraintError';
}

async function readFromStore<T>(
  db: IDBDatabase,
  storeName: ObjectStoreName,
  requestFactory: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const transaction = db.transaction(storeName, 'readonly');
  const request = requestFactory(transaction.objectStore(storeName));
  return requestToPromise(request);
}

async function writeToStore(
  db: IDBDatabase,
  storeNames: ObjectStoreName[],
  requestFactory: (
    transaction: IDBTransaction,
  ) => IndexedDbWriteRequest | IndexedDbWriteRequest[],
) {
  const transaction = db.transaction(storeNames, 'readwrite');
  const requests = requestFactory(transaction);
  const requestList = Array.isArray(requests) ? requests : [requests];
  await Promise.all(requestList.map(writeRequestToPromise));
  await waitForTransaction(transaction);
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function writeRequestToPromise(request: IndexedDbWriteRequest) {
  return new Promise<IDBValidKey | undefined>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB write request failed.'));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
  });
}
