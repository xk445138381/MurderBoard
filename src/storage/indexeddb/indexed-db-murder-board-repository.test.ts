import { IndexedDbClient } from './indexed-db-client';
import { IndexedDbMurderBoardRepository } from './indexed-db-murder-board-repository';

function uniqueDatabaseName() {
  return `murderboard-repository-test-${Math.random().toString(36).slice(2)}`;
}

function createRepository() {
  let idSequence = 0;
  let clockSequence = 0;
  const client = new IndexedDbClient({ dbName: uniqueDatabaseName() });
  const repository = new IndexedDbMurderBoardRepository({
    client,
    idFactory: () => `id-${++idSequence}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, clockSequence++)).toISOString(),
  });

  return { client, repository };
}

async function closeClient(client: IndexedDbClient) {
  const db = await client.init();
  db.close();
}

describe('IndexedDbMurderBoardRepository', () => {
  it('creates workspaces with structured DateTime fields', async () => {
    const { client, repository } = createRepository();

    const workspace = await repository.createWorkspace({
      name: '  红楼谜案  ',
      description: '大观园连续事件',
    });

    expect(workspace).toMatchObject({
      id: 'id-1',
      name: '红楼谜案',
      description: '大观园连续事件',
      deletedAt: null,
    });
    expect(workspace.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(await repository.listWorkspaces()).toEqual([workspace]);

    await closeClient(client);
  });

  it('prevents duplicate workspace names', async () => {
    const { client, repository } = createRepository();
    await repository.createWorkspace({ name: '红楼谜案' });

    await expect(repository.createWorkspace({ name: '红楼谜案' })).rejects.toMatchObject({
      code: 'DUPLICATE_WORKSPACE_NAME',
    });

    await closeClient(client);
  });

  it('updates workspace names and descriptions with duplicate-name checks', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '旧剧本' });
    await repository.createWorkspace({ name: '已占用剧本' });

    const updatedWorkspace = await repository.updateWorkspace(workspace.id, {
      name: '新剧本',
      description: '新的简介',
    });

    expect(updatedWorkspace).toMatchObject({
      id: workspace.id,
      name: '新剧本',
      description: '新的简介',
      deletedAt: null,
    });
    await expect(
      repository.updateWorkspace(workspace.id, { name: '已占用剧本' }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_WORKSPACE_NAME',
    });

    await closeClient(client);
  });

  it('prevents duplicate case names only inside the same workspace', async () => {
    const { client, repository } = createRepository();
    const firstWorkspace = await repository.createWorkspace({ name: '剧本 A' });
    const secondWorkspace = await repository.createWorkspace({ name: '剧本 B' });

    const firstCase = await repository.createCase(firstWorkspace.id, {
      name: '第一夜',
      summary: '雨夜开场',
    });
    const secondCase = await repository.createCase(secondWorkspace.id, {
      name: '第一夜',
    });

    expect(firstCase).toMatchObject({
      workspaceId: firstWorkspace.id,
      name: '第一夜',
      status: 'draft',
      deletedAt: null,
    });
    expect(secondCase.workspaceId).toBe(secondWorkspace.id);
    await expect(
      repository.createCase(firstWorkspace.id, { name: '第一夜' }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_CASE_NAME',
      workspaceId: firstWorkspace.id,
      caseName: '第一夜',
    });

    await closeClient(client);
  });

  it('filters soft-deleted workspaces and cases from default lists', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, {
      name: '第一夜',
      status: 'active',
    });

    const deletedCase = await repository.softDeleteCase(caseRecord.id);

    expect(deletedCase.status).toBe('deleted');
    expect(deletedCase.statusBeforeDelete).toBe('active');
    expect(await repository.listCases(workspace.id)).toEqual([]);
    expect(await repository.listCases(workspace.id, { includeDeleted: true })).toEqual([
      deletedCase,
    ]);

    await repository.softDeleteWorkspace(workspace.id);

    expect(await repository.listWorkspaces()).toEqual([]);
    expect(await repository.listWorkspaces({ includeDeleted: true })).toHaveLength(1);

    await closeClient(client);
  });

  it('updates case names, summaries, statuses, and archives cases', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const firstCase = await repository.createCase(workspace.id, { name: '第一夜' });
    await repository.createCase(workspace.id, { name: '第二夜' });

    const activeCase = await repository.updateCase(firstCase.id, {
      name: '序章',
      summary: '所有角色入场',
      status: 'active',
    });

    expect(activeCase).toMatchObject({
      name: '序章',
      summary: '所有角色入场',
      status: 'active',
      archivedAt: null,
    });

    const archivedCase = await repository.archiveCase(firstCase.id);

    expect(archivedCase.status).toBe('archived');
    expect(archivedCase.archivedAt).toEqual(expect.any(String));
    expect(await repository.listCases(workspace.id, { status: 'archived' })).toEqual([
      archivedCase,
    ]);
    await expect(repository.updateCase(firstCase.id, { name: '第二夜' })).rejects.toMatchObject({
      code: 'DUPLICATE_CASE_NAME',
      workspaceId: workspace.id,
      caseName: '第二夜',
    });

    await closeClient(client);
  });

  it('creates characters, clues, event relations, and sorted timeline events', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });
    const character = await repository.createCharacter(caseRecord.id, {
      name: '侦探',
      role: '调查者',
    });
    const clue = await repository.createClue(caseRecord.id, {
      title: '怀表',
      discoveredAt: '2026-01-01T20:00:00+08:00',
    });

    const laterEvent = await repository.createEvent(caseRecord.id, {
      title: '发现怀表',
      occurredAt: '2026-01-01T20:00:00+08:00',
      relatedCharacterIds: [character.id, character.id],
      relatedClueIds: [clue.id],
    });
    const earlierEvent = await repository.createEvent(caseRecord.id, {
      title: '停电',
      occurredAt: '2026-01-01T19:30:00+08:00',
    });

    expect(await repository.listEvents(caseRecord.id)).toEqual([earlierEvent, laterEvent]);
    expect(await repository.listEventCharacters(laterEvent.id)).toEqual([
      {
        id: `${laterEvent.id}:${character.id}`,
        eventId: laterEvent.id,
        characterId: character.id,
      },
    ]);
    expect(await repository.listEventClues(laterEvent.id)).toEqual([
      {
        id: `${laterEvent.id}:${clue.id}`,
        eventId: laterEvent.id,
        clueId: clue.id,
      },
    ]);

    await closeClient(client);
  });

  it('sorts timeline events by parsed instant across timezone offsets', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });

    const earlierInstant = await repository.createEvent(caseRecord.id, {
      title: '北京时间晚八点',
      occurredAt: '2026-01-01T20:00:00+08:00',
    });
    const laterInstant = await repository.createEvent(caseRecord.id, {
      title: '纽约早晨七点半',
      occurredAt: '2026-01-01T07:30:00-05:00',
    });

    expect(await repository.listEvents(caseRecord.id)).toEqual([earlierInstant, laterInstant]);
    await closeClient(client);
  });

  it('validates structured DateTime inputs for story times', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });

    await expect(
      repository.createEvent(caseRecord.id, {
        title: '模糊时间',
        occurredAt: '第一幕夜晚',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { fieldName: 'occurredAt', value: '第一幕夜晚' },
    });

    await closeClient(client);
  });

  it('updates and soft-deletes characters and clues from default lists', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });
    const character = await repository.createCharacter(caseRecord.id, {
      name: '侦探',
      role: '玩家',
    });
    const clue = await repository.createClue(caseRecord.id, {
      title: '怀表',
      discoveredAt: '2026-01-01T20:00:00+08:00',
    });

    const updatedCharacter = await repository.updateCharacter(character.id, {
      name: '老侦探',
      notes: '见过相似案件',
    });
    const updatedClue = await repository.updateClue(clue.id, {
      title: '破损怀表',
      discoveredAt: null,
    });

    expect(updatedCharacter).toMatchObject({
      id: character.id,
      name: '老侦探',
      role: '玩家',
      notes: '见过相似案件',
    });
    expect(updatedClue).toMatchObject({
      id: clue.id,
      title: '破损怀表',
      discoveredAt: null,
    });

    const deletedCharacter = await repository.softDeleteCharacter(character.id);
    const deletedClue = await repository.softDeleteClue(clue.id);

    expect(deletedCharacter.deletedAt).toEqual(expect.any(String));
    expect(deletedClue.deletedAt).toEqual(expect.any(String));
    expect(await repository.listCharacters(caseRecord.id)).toEqual([]);
    expect(await repository.listClues(caseRecord.id)).toEqual([]);
    expect(await repository.listCharacters(caseRecord.id, { includeDeleted: true })).toEqual([
      deletedCharacter,
    ]);
    expect(await repository.listClues(caseRecord.id, { includeDeleted: true })).toEqual([
      deletedClue,
    ]);

    await closeClient(client);
  });

  it('updates event details and replaces event relations', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });
    const firstCharacter = await repository.createCharacter(caseRecord.id, { name: '侦探' });
    const secondCharacter = await repository.createCharacter(caseRecord.id, { name: '嫌疑人' });
    const firstClue = await repository.createClue(caseRecord.id, { title: '怀表' });
    const secondClue = await repository.createClue(caseRecord.id, { title: '脚印' });
    const event = await repository.createEvent(caseRecord.id, {
      title: '发现怀表',
      occurredAt: '2026-01-01T20:00:00+08:00',
      relatedCharacterIds: [firstCharacter.id],
      relatedClueIds: [firstClue.id],
    });

    const updatedEvent = await repository.updateEvent(event.id, {
      title: '发现脚印',
      occurredAt: '2026-01-01T19:45:00+08:00',
      relatedCharacterIds: [secondCharacter.id],
      relatedClueIds: [secondClue.id],
    });

    expect(updatedEvent).toMatchObject({
      id: event.id,
      title: '发现脚印',
      occurredAt: '2026-01-01T19:45:00+08:00',
    });
    expect(await repository.listEventCharacters(event.id)).toEqual([
      {
        id: `${event.id}:${secondCharacter.id}`,
        eventId: event.id,
        characterId: secondCharacter.id,
      },
    ]);
    expect(await repository.listEventClues(event.id)).toEqual([
      {
        id: `${event.id}:${secondClue.id}`,
        eventId: event.id,
        clueId: secondClue.id,
      },
    ]);

    const deletedEvent = await repository.softDeleteEvent(event.id);

    expect(deletedEvent.deletedAt).toEqual(expect.any(String));
    expect(await repository.listEvents(caseRecord.id)).toEqual([]);
    expect(await repository.listEvents(caseRecord.id, { includeDeleted: true })).toEqual([
      deletedEvent,
    ]);

    await closeClient(client);
  });

  it('preserves unchanged deleted event relations but rejects newly added deleted or missing relations', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });
    const linkedCharacter = await repository.createCharacter(caseRecord.id, { name: '侦探' });
    const linkedClue = await repository.createClue(caseRecord.id, { title: '怀表' });
    const deletedCharacter = await repository.createCharacter(caseRecord.id, { name: '嫌疑人' });
    const deletedClue = await repository.createClue(caseRecord.id, { title: '脚印' });
    const event = await repository.createEvent(caseRecord.id, {
      title: '发现怀表',
      occurredAt: '2026-01-01T20:00:00+08:00',
      relatedCharacterIds: [linkedCharacter.id],
      relatedClueIds: [linkedClue.id],
    });

    await repository.softDeleteCharacter(linkedCharacter.id);
    await repository.softDeleteClue(linkedClue.id);
    await repository.softDeleteCharacter(deletedCharacter.id);
    await repository.softDeleteClue(deletedClue.id);

    const updatedEvent = await repository.updateEvent(event.id, {
      title: '重新记录发现怀表',
      relatedCharacterIds: [linkedCharacter.id],
      relatedClueIds: [linkedClue.id],
    });

    expect(updatedEvent).toMatchObject({
      id: event.id,
      title: '重新记录发现怀表',
    });
    expect(await repository.listEventCharacters(event.id)).toEqual([
      {
        id: `${event.id}:${linkedCharacter.id}`,
        eventId: event.id,
        characterId: linkedCharacter.id,
      },
    ]);
    expect(await repository.listEventClues(event.id)).toEqual([
      {
        id: `${event.id}:${linkedClue.id}`,
        eventId: event.id,
        clueId: linkedClue.id,
      },
    ]);
    await expect(
      repository.updateEvent(event.id, {
        relatedCharacterIds: [linkedCharacter.id, deletedCharacter.id],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resourceType: 'Character', resourceId: deletedCharacter.id },
    });
    await expect(
      repository.updateEvent(event.id, {
        relatedClueIds: [linkedClue.id, deletedClue.id],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resourceType: 'Clue', resourceId: deletedClue.id },
    });
    await expect(
      repository.updateEvent(event.id, {
        relatedCharacterIds: [linkedCharacter.id, 'missing-character'],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resourceType: 'Character', resourceId: 'missing-character' },
    });

    await closeClient(client);
  });

  it('rejects event relations outside the event case', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const firstCase = await repository.createCase(workspace.id, { name: '第一夜' });
    const secondCase = await repository.createCase(workspace.id, { name: '第二夜' });
    const otherCaseCharacter = await repository.createCharacter(secondCase.id, { name: '旁观者' });

    await expect(
      repository.createEvent(firstCase.id, {
        title: '错误关联',
        occurredAt: '2026-01-01T20:00:00+08:00',
        relatedCharacterIds: [otherCaseCharacter.id],
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      details: { resourceType: 'Character', resourceId: otherCaseCharacter.id },
    });

    await closeClient(client);
  });

  it('lists trash entries and restores deleted cases to their previous status', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, {
      name: '第一夜',
      status: 'active',
    });
    await repository.softDeleteCase(caseRecord.id);

    expect(await repository.listTrashEntries()).toEqual([
      expect.objectContaining({
        id: `case:${caseRecord.id}`,
        resourceId: caseRecord.id,
        resourceType: 'case',
        label: '第一夜',
        parentLabel: '剧本 A',
      }),
    ]);

    await repository.restoreTrashEntry('case', caseRecord.id);

    expect(await repository.listTrashEntries()).toEqual([]);
    expect(await repository.getCase(caseRecord.id)).toMatchObject({
      id: caseRecord.id,
      status: 'active',
      deletedAt: null,
      statusBeforeDelete: null,
    });

    await closeClient(client);
  });

  it('purges deleted records and validates permanent delete state', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });
    const character = await repository.createCharacter(caseRecord.id, { name: '侦探' });
    await repository.softDeleteCharacter(character.id);

    await repository.purgeTrashEntry('character', character.id);

    expect(await repository.listCharacters(caseRecord.id, { includeDeleted: true })).toEqual([]);
    await expect(repository.purgeTrashEntry('case', caseRecord.id)).rejects.toMatchObject({
      code: 'NOT_DELETED',
    });

    await closeClient(client);
  });

  it('purges a deleted case with child records and event relations', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const caseRecord = await repository.createCase(workspace.id, { name: '第一夜' });
    const character = await repository.createCharacter(caseRecord.id, { name: '侦探' });
    const clue = await repository.createClue(caseRecord.id, { title: '脚印' });
    const event = await repository.createEvent(caseRecord.id, {
      title: '发现脚印',
      occurredAt: '2026-01-01T20:00:00+08:00',
      relatedCharacterIds: [character.id],
      relatedClueIds: [clue.id],
    });
    await repository.softDeleteCase(caseRecord.id);

    await repository.purgeCase(caseRecord.id);

    expect(await repository.getCase(caseRecord.id, { includeDeleted: true })).toBeNull();
    expect(await repository.listCharacters(caseRecord.id, { includeDeleted: true })).toEqual([]);
    expect(await repository.listClues(caseRecord.id, { includeDeleted: true })).toEqual([]);
    expect(await repository.listEvents(caseRecord.id, { includeDeleted: true })).toEqual([]);
    expect(await repository.listEventCharacters(event.id)).toEqual([]);
    expect(await repository.listEventClues(event.id)).toEqual([]);

    await closeClient(client);
  });

  it('restores archived cases as new active cases with remapped child relations', async () => {
    const { client, repository } = createRepository();
    const sourceWorkspace = await repository.createWorkspace({ name: '源剧本' });
    const targetWorkspace = await repository.createWorkspace({ name: '目标剧本' });
    const sourceCase = await repository.createCase(sourceWorkspace.id, {
      name: '第一夜',
      summary: '雨夜开场',
      status: 'active',
    });
    const character = await repository.createCharacter(sourceCase.id, { name: '侦探' });
    const clue = await repository.createClue(sourceCase.id, { title: '脚印' });
    const event = await repository.createEvent(sourceCase.id, {
      title: '发现脚印',
      occurredAt: '2026-01-01T20:00:00+08:00',
      relatedCharacterIds: [character.id],
      relatedClueIds: [clue.id],
    });
    const archivedCase = await repository.archiveCase(sourceCase.id);

    const restoredCase = await repository.restoreArchivedCase(sourceCase.id, {
      targetWorkspaceId: targetWorkspace.id,
      name: '第一夜复盘',
    });

    expect(restoredCase).toMatchObject({
      workspaceId: targetWorkspace.id,
      name: '第一夜复盘',
      summary: '雨夜开场',
      status: 'active',
      archivedAt: null,
      deletedAt: null,
    });
    expect(restoredCase.id).not.toBe(sourceCase.id);
    expect(await repository.getCase(sourceCase.id)).toEqual(archivedCase);

    const restoredCharacters = await repository.listCharacters(restoredCase.id);
    const restoredClues = await repository.listClues(restoredCase.id);
    const restoredEvents = await repository.listEvents(restoredCase.id);

    expect(restoredCharacters).toHaveLength(1);
    expect(restoredClues).toHaveLength(1);
    expect(restoredEvents).toHaveLength(1);
    expect(restoredCharacters[0]).toMatchObject({
      caseId: restoredCase.id,
      name: '侦探',
      deletedAt: null,
    });
    expect(restoredCharacters[0].id).not.toBe(character.id);
    expect(restoredClues[0]).toMatchObject({
      caseId: restoredCase.id,
      title: '脚印',
      deletedAt: null,
    });
    expect(restoredClues[0].id).not.toBe(clue.id);
    expect(restoredEvents[0]).toMatchObject({
      caseId: restoredCase.id,
      title: '发现脚印',
      occurredAt: event.occurredAt,
      deletedAt: null,
    });
    expect(await repository.listEventCharacters(restoredEvents[0].id)).toEqual([
      {
        id: `${restoredEvents[0].id}:${restoredCharacters[0].id}`,
        eventId: restoredEvents[0].id,
        characterId: restoredCharacters[0].id,
      },
    ]);
    expect(await repository.listEventClues(restoredEvents[0].id)).toEqual([
      {
        id: `${restoredEvents[0].id}:${restoredClues[0].id}`,
        eventId: restoredEvents[0].id,
        clueId: restoredClues[0].id,
      },
    ]);

    await closeClient(client);
  });

  it('copies cases across workspaces with remapped child relations', async () => {
    const { client, repository } = createRepository();
    const sourceWorkspace = await repository.createWorkspace({ name: '源剧本' });
    const targetWorkspace = await repository.createWorkspace({ name: '目标剧本' });
    const sourceCase = await repository.createCase(sourceWorkspace.id, {
      name: '第一夜',
      summary: '雨夜开场',
      status: 'active',
    });
    const character = await repository.createCharacter(sourceCase.id, { name: '侦探' });
    const clue = await repository.createClue(sourceCase.id, { title: '脚印' });
    const event = await repository.createEvent(sourceCase.id, {
      title: '发现脚印',
      occurredAt: '2026-01-01T20:00:00+08:00',
      relatedCharacterIds: [character.id],
      relatedClueIds: [clue.id],
    });

    const copiedCase = await repository.copyCase(sourceCase.id, {
      targetWorkspaceId: targetWorkspace.id,
      name: '第一夜副本',
    });

    expect(copiedCase).toMatchObject({
      workspaceId: targetWorkspace.id,
      name: '第一夜副本',
      summary: '雨夜开场',
      status: 'active',
      deletedAt: null,
    });
    expect(copiedCase.id).not.toBe(sourceCase.id);
    expect(await repository.getCase(sourceCase.id)).toEqual(sourceCase);

    const copiedCharacters = await repository.listCharacters(copiedCase.id);
    const copiedClues = await repository.listClues(copiedCase.id);
    const copiedEvents = await repository.listEvents(copiedCase.id);

    expect(copiedCharacters[0]).toMatchObject({ caseId: copiedCase.id, name: '侦探' });
    expect(copiedCharacters[0].id).not.toBe(character.id);
    expect(copiedClues[0]).toMatchObject({ caseId: copiedCase.id, title: '脚印' });
    expect(copiedClues[0].id).not.toBe(clue.id);
    expect(copiedEvents[0]).toMatchObject({
      caseId: copiedCase.id,
      title: '发现脚印',
      occurredAt: event.occurredAt,
    });
    expect(await repository.listEventCharacters(copiedEvents[0].id)).toEqual([
      {
        id: `${copiedEvents[0].id}:${copiedCharacters[0].id}`,
        eventId: copiedEvents[0].id,
        characterId: copiedCharacters[0].id,
      },
    ]);
    expect(await repository.listEventClues(copiedEvents[0].id)).toEqual([
      {
        id: `${copiedEvents[0].id}:${copiedClues[0].id}`,
        eventId: copiedEvents[0].id,
        clueId: copiedClues[0].id,
      },
    ]);

    await closeClient(client);
  });

  it('moves cases between workspaces and rejects duplicate target names', async () => {
    const { client, repository } = createRepository();
    const sourceWorkspace = await repository.createWorkspace({ name: '源剧本' });
    const targetWorkspace = await repository.createWorkspace({ name: '目标剧本' });
    const sourceCase = await repository.createCase(sourceWorkspace.id, { name: '第一夜' });
    await repository.createCase(targetWorkspace.id, { name: '已占用案件' });

    await expect(
      repository.moveCase(sourceCase.id, {
        targetWorkspaceId: targetWorkspace.id,
        name: '已占用案件',
      }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_CASE_NAME',
      workspaceId: targetWorkspace.id,
      caseName: '已占用案件',
    });

    const movedCase = await repository.moveCase(sourceCase.id, {
      targetWorkspaceId: targetWorkspace.id,
      name: '迁移后案件',
    });

    expect(movedCase).toMatchObject({
      id: sourceCase.id,
      workspaceId: targetWorkspace.id,
      name: '迁移后案件',
    });
    expect(await repository.listCases(sourceWorkspace.id)).toEqual([]);
    expect(await repository.listCases(targetWorkspace.id)).toContainEqual(movedCase);

    await closeClient(client);
  });

  it('previews import name conflicts and imports case snapshots with relations', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    await repository.createCase(workspace.id, { name: '已存在案件' });

    const draft = {
      name: '导入案件',
      summary: '外部整理的案件',
      characters: [{ name: '侦探', role: '调查者' }],
      clues: [
        {
          title: '怀表',
          content: '停在午夜',
          discoveredAt: '2026-01-01T20:00:00+08:00',
        },
      ],
      events: [
        {
          title: '发现怀表',
          occurredAt: '2026-01-01T20:00:00+08:00',
          relatedCharacterNames: ['侦探'],
          relatedClueTitles: ['怀表'],
        },
      ],
    };

    await expect(
      repository.previewCaseImport(workspace.id, { ...draft, name: '已存在案件' }),
    ).resolves.toMatchObject({
      name: '已存在案件',
      canImport: false,
      conflicts: [{ fieldName: 'caseName', value: '已存在案件' }],
    });

    const preview = await repository.previewCaseImport(workspace.id, draft);

    expect(preview).toMatchObject({
      name: '导入案件',
      canImport: true,
      counts: { characters: 1, clues: 1, events: 1 },
    });

    const importedCase = await repository.importCaseDraft(workspace.id, draft);
    const importedCharacters = await repository.listCharacters(importedCase.id);
    const importedClues = await repository.listClues(importedCase.id);
    const importedEvents = await repository.listEvents(importedCase.id);

    expect(importedCase).toMatchObject({
      workspaceId: workspace.id,
      name: '导入案件',
      status: 'active',
      summary: '外部整理的案件',
    });
    expect(importedCharacters[0]).toMatchObject({ name: '侦探', role: '调查者' });
    expect(importedClues[0]).toMatchObject({
      title: '怀表',
      content: '停在午夜',
      discoveredAt: '2026-01-01T20:00:00+08:00',
    });
    expect(importedEvents[0]).toMatchObject({
      title: '发现怀表',
      occurredAt: '2026-01-01T20:00:00+08:00',
    });
    expect(await repository.listEventCharacters(importedEvents[0].id)).toEqual([
      {
        id: `${importedEvents[0].id}:${importedCharacters[0].id}`,
        eventId: importedEvents[0].id,
        characterId: importedCharacters[0].id,
      },
    ]);
    expect(await repository.listEventClues(importedEvents[0].id)).toEqual([
      {
        id: `${importedEvents[0].id}:${importedClues[0].id}`,
        eventId: importedEvents[0].id,
        clueId: importedClues[0].id,
      },
    ]);
    await expect(repository.importCaseDraft(workspace.id, draft)).rejects.toMatchObject({
      code: 'DUPLICATE_CASE_NAME',
      caseName: '导入案件',
    });

    await closeClient(client);
  });

  it('previews duplicate imported relation labels as conflicts', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const draft = {
      name: '导入案件',
      characters: [
        { name: '侦探', role: '调查者' },
        { name: '侦探', role: '伪装者' },
      ],
      clues: [
        { title: '怀表', content: '停在午夜' },
        { title: '怀表', content: '藏在书房' },
      ],
      events: [
        {
          title: '发现怀表',
          occurredAt: '2026-01-01T20:00:00+08:00',
          relatedCharacterNames: ['侦探'],
          relatedClueTitles: ['怀表'],
        },
      ],
    };

    const preview = await repository.previewCaseImport(workspace.id, draft);

    expect(preview).toMatchObject({
      name: '导入案件',
      canImport: false,
      counts: { characters: 2, clues: 2, events: 1 },
    });
    expect(preview.conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldName: 'characters.name', value: '侦探' }),
        expect.objectContaining({ fieldName: 'clues.title', value: '怀表' }),
      ]),
    );

    await closeClient(client);
  });

  it('rejects imports with duplicate relation labels before creating data', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const draft = {
      name: '导入案件',
      characters: [{ name: '侦探' }, { name: '侦探' }],
      clues: [{ title: '怀表' }, { title: '怀表' }],
      events: [
        {
          title: '发现怀表',
          occurredAt: '2026-01-01T20:00:00+08:00',
          relatedCharacterNames: ['侦探'],
          relatedClueTitles: ['怀表'],
        },
      ],
    };

    await expect(repository.importCaseDraft(workspace.id, draft)).rejects.toMatchObject({
      name: 'StorageValidationError',
      code: 'VALIDATION_FAILED',
    });
    expect(await repository.listCases(workspace.id)).toEqual([]);

    await closeClient(client);
  });

  it('rejects archive restore name conflicts and non-archived cases', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: '剧本 A' });
    const archivedSource = await repository.createCase(workspace.id, { name: '第一夜' });
    const activeSource = await repository.createCase(workspace.id, { name: '第二夜' });
    await repository.archiveCase(archivedSource.id);

    await expect(
      repository.restoreArchivedCase(archivedSource.id, {
        targetWorkspaceId: workspace.id,
        name: '第二夜',
      }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_CASE_NAME',
      workspaceId: workspace.id,
      caseName: '第二夜',
    });
    await expect(repository.restoreArchivedCase(activeSource.id)).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    await closeClient(client);
  });
});
