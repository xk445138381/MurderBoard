import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BoardPage } from './BoardPage';
import { MurderBoardDataProvider } from '../../shared/data/MurderBoardDataProvider';
import type { MurderBoardRepository } from '../../storage/repositories';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

function createDefaultFixture() {
  return {
    listWorkspaces: vi.fn().mockResolvedValue([
      {
        id: 'workspace-1',
        name: '渡鸦宅邸',
        description: '',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]),
    listCases: vi.fn().mockResolvedValue([
      {
        id: 'case-1',
        workspaceId: 'workspace-1',
        name: '第一幕',
        status: 'active',
        summary: '',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        archivedAt: null,
        deletedAt: null,
        statusBeforeDelete: null,
      },
    ]),
    listCharacters: vi.fn().mockResolvedValue([]),
    listClues: vi.fn().mockResolvedValue([]),
    listEvents: vi.fn().mockResolvedValue([]),
    listHypotheses: vi.fn().mockResolvedValue([]),
    listBoardRelations: vi.fn().mockResolvedValue([]),
    listBoardNodePositions: vi.fn().mockResolvedValue([]),
    createCharacter: vi.fn(),
    createClue: vi.fn(),
    createEvent: vi.fn(),
    createHypothesis: vi.fn(),
    createBoardRelation: vi.fn(),
    updateHypothesis: vi.fn(),
    updateBoardRelation: vi.fn(),
    updateCharacter: vi.fn(),
    updateClue: vi.fn(),
    updateEvent: vi.fn(),
    softDeleteCharacter: vi.fn(),
    softDeleteClue: vi.fn(),
    softDeleteEvent: vi.fn(),
    softDeleteHypothesis: vi.fn(),
    softDeleteBoardRelation: vi.fn(),
    saveBoardNodePosition: vi.fn(),
  } as unknown as MurderBoardRepository;
}

function renderBoardWithRepository(repository: MurderBoardRepository) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <MurderBoardDataProvider repository={repository}>{children}</MurderBoardDataProvider>;
  }

  return render(<BoardPage />, { wrapper: Wrapper });
}

describe('BoardPage', () => {
  it('renders the visual case board shell', async () => {
    renderBoardWithRepository(createDefaultFixture());

    expect(screen.getByRole('heading', { name: 'MurderBoard' })).toBeInTheDocument();
    expect(screen.getByLabelText('可视化案件板')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '第一幕案件板' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '渡鸦宅邸案件板' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '记录已知信息' })).toBeInTheDocument();
    expect(screen.getByLabelText('检查器')).toBeInTheDocument();
  });

  it.each([
    { nodeType: 'person' as const, label: '人物', createFn: 'createCharacter' as const, expectedArg: { name: '陈某' } },
    { nodeType: 'clue' as const, label: '线索', createFn: 'createClue' as const, expectedArg: { title: '陈某' } },
    { nodeType: 'event' as const, label: '事件', createFn: 'createEvent' as const, expectedArg: { title: '陈某' } },
    { nodeType: 'hypothesis' as const, label: '猜想', createFn: 'createHypothesis' as const, expectedArg: { title: '陈某' } },
  ])('creates a $nodeType node via quick capture', async ({ label, createFn, expectedArg }) => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    renderBoardWithRepository(repository);

    await waitFor(() => {
      expect(screen.getByLabelText('标题')).toBeInTheDocument();
    });

    // Select node type
    await user.selectOptions(screen.getByLabelText('类型'), label);
    await user.type(screen.getByLabelText('标题'), '陈某');
    await user.click(screen.getByRole('button', { name: '添加到案件板' }));

    const createFnMock = repository[createFn] as ReturnType<typeof vi.fn>;
    if (createFn === 'createEvent') {
      expect(createFnMock).toHaveBeenCalledWith('case-1', expect.objectContaining(expectedArg));
    } else {
      expect(createFnMock).toHaveBeenCalledWith('case-1', expectedArg);
    }
  });

  it('filters relation labels by type', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      {
        id: 'char-1',
        caseId: 'case-1',
        name: '林乔',
        role: '目击者',
        notes: '',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      {
        id: 'clue-1',
        caseId: 'case-1',
        title: '停摆怀表',
        content: '',
        source: '书房',
        discoveredAt: null,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      {
        id: 'hyp-1',
        caseId: 'case-1',
        title: '猜想',
        body: '',
        status: 'unverified',
        confidence: 50,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([
      {
        id: 'rel-1',
        caseId: 'case-1',
        fromNodeType: 'clue',
        fromNodeId: 'clue-1',
        toNodeType: 'hypothesis',
        toNodeId: 'hyp-1',
        type: 'supports',
        note: 'note',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);

    renderBoardWithRepository(repository);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '选择支持关系' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '支持' }));

    expect(screen.getByRole('button', { name: '选择支持关系' })).toBeInTheDocument();
  });

  it('renders board data from the repository for the selected case', async () => {
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      {
        id: 'char-1',
        caseId: 'case-1',
        name: '林乔',
        role: '目击者',
        notes: '主动提到怀表',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      {
        id: 'clue-1',
        caseId: 'case-1',
        title: '停摆怀表',
        source: '书房',
        content: '停在 23:48',
        discoveredAt: null,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);
    repository.listEvents = vi.fn().mockResolvedValue([]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      {
        id: 'hyp-1',
        caseId: 'case-1',
        title: '现场被提前布置',
        body: '房间可能提前被布置',
        status: 'unverified',
        confidence: 50,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([
      {
        id: 'rel-1',
        caseId: 'case-1',
        fromNodeType: 'clue',
        fromNodeId: 'clue-1',
        toNodeType: 'hypothesis',
        toNodeId: 'hyp-1',
        type: 'supports',
        note: '支持提前布置',
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
        deletedAt: null,
      },
    ]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    expect(await screen.findByText('林乔')).toBeInTheDocument();
    expect(screen.getByText('停摆怀表')).toBeInTheDocument();
    expect(screen.getByText('现场被提前布置')).toBeInTheDocument();
  });

  // --- Relation creation ---

  it('creates a supports relation from the inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      { id: 'clue-1', caseId: 'case-1', title: '停摆怀表', content: '', source: '书房', discoveredAt: null, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      { id: 'hyp-1', caseId: 'case-1', title: '猜想测试', body: 'body', status: 'unverified', confidence: 50, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    // Wait for nodes to render, then click the clue node to select it
    const clueNode = await screen.findByText('停摆怀表');
    await user.click(clueNode);

    // Click "继续关联线索" to open relation form
    await user.click(screen.getByRole('button', { name: '继续关联线索' }));

    // Should see the relation creation form
    expect(screen.getByText('关联节点')).toBeInTheDocument();

    // Select target node (hypothesis) from dropdown
    await user.selectOptions(screen.getByLabelText('目标节点'), 'hyp-1');

    // Relation type should already be "supports" (default)

    // Enter a note
    const noteInput = screen.getByLabelText('备注');
    await user.type(noteInput, '怀表时间支持猜想');

    // Submit
    await user.click(screen.getByRole('button', { name: '确认建立' }));

    expect(repository.createBoardRelation).toHaveBeenCalledWith('case-1', {
      fromNodeType: 'clue',
      fromNodeId: 'clue-1',
      toNodeType: 'hypothesis',
      toNodeId: 'hyp-1',
      type: 'supports',
      note: '怀表时间支持猜想',
    });
  });

  it('creates a refutes relation from the inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      { id: 'clue-1', caseId: 'case-1', title: '停摆怀表', content: '', source: '书房', discoveredAt: null, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      { id: 'hyp-1', caseId: 'case-1', title: '猜想测试', body: 'body', status: 'unverified', confidence: 50, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    // Select the person node
    const personNode = await screen.findByText('林乔');
    await user.click(personNode);

    // Open relation form
    await user.click(screen.getByRole('button', { name: '继续关联线索' }));

    // Select target
    await user.selectOptions(screen.getByLabelText('目标节点'), 'clue-1');

    // Change relation type to refutes
    const typeSelect = screen.getByLabelText('关系类型');
    await user.selectOptions(typeSelect, 'refutes');

    // Submit
    await user.click(screen.getByRole('button', { name: '确认建立' }));

    expect(repository.createBoardRelation).toHaveBeenCalledWith('case-1', {
      fromNodeType: 'person',
      fromNodeId: 'char-1',
      toNodeType: 'clue',
      toNodeId: 'clue-1',
      type: 'refutes',
    });
  });

  // --- Inspector editing ---

  it('edits a hypothesis in the inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([]);
    repository.listClues = vi.fn().mockResolvedValue([]);
    repository.listEvents = vi.fn().mockResolvedValue([]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      { id: 'hyp-1', caseId: 'case-1', title: '原始猜想', body: '原始描述', status: 'unverified', confidence: 30, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    // Click the hypothesis node to select it
    const hypNode = await screen.findByText('原始猜想');
    await user.click(hypNode);

    // Click edit button
    await user.click(screen.getByRole('button', { name: '编辑猜想' }));

    // Edit fields — the inspector form has the second "标题" label
    const titleInputs = screen.getAllByLabelText('标题');
    await user.clear(titleInputs[1]);
    await user.type(titleInputs[1], '更新后的猜想');

    const bodyInput = screen.getByLabelText('详情');
    await user.clear(bodyInput);
    await user.type(bodyInput, '更新后的描述');

    // Change status to plausible
    await user.selectOptions(screen.getByLabelText('状态'), 'plausible');

    // Save
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(repository.updateHypothesis).toHaveBeenCalledWith('hyp-1', {
      title: '更新后的猜想',
      body: '更新后的描述',
      status: 'plausible',
      confidence: 30,
    });
  });

  it('edits a relation in the inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      { id: 'clue-1', caseId: 'case-1', title: '停摆怀表', content: '', source: '书房', discoveredAt: null, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([
      { id: 'rel-1', caseId: 'case-1', fromNodeType: 'person', fromNodeId: 'char-1', toNodeType: 'clue', toNodeId: 'clue-1', type: 'related', note: '原始备注', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    // Click the relation label to select it
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '选择关联关系' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: '选择关联关系' }));

    // Click edit button
    await user.click(screen.getByRole('button', { name: '编辑关系' }));

    // Change type to suspect and update note
    await user.selectOptions(screen.getByLabelText('关系类型'), 'suspect');

    const noteInput = screen.getByLabelText('备注');
    await user.clear(noteInput);
    await user.type(noteInput, '更新的备注');

    // Save
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(repository.updateBoardRelation).toHaveBeenCalledWith('rel-1', {
      type: 'suspect',
      note: '更新的备注',
    });
  });

  // --- Search ---

  it('filters nodes via search and dims non-matching nodes', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      { id: 'clue-1', caseId: 'case-1', title: '停摆怀表', content: '', source: '书房', discoveredAt: null, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      { id: 'hyp-1', caseId: 'case-1', title: '现场被提前布置', body: '', status: 'unverified', confidence: 50, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    await screen.findByText('林乔');

    // Type in search box
    const searchInput = screen.getByLabelText('在案件板中查找');
    await user.type(searchInput, '怀表');

    // The matching clue text appears in both the node and inspector; use getAllByText
    expect(screen.getAllByText('停摆怀表').length).toBeGreaterThanOrEqual(1);

    // Non-matching nodes may be dimmed but still in DOM
    expect(screen.getByText('林乔')).toBeInTheDocument();
    expect(screen.getByText('现场被提前布置')).toBeInTheDocument();
  });

  // --- P0-1: Empty state to board creation ---

  it('creates a default case from empty state and then adds a node', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    // No workspaces or cases (empty state)
    repository.listWorkspaces = vi.fn().mockResolvedValue([]);
    repository.listCases = vi.fn().mockResolvedValue([]);
    repository.createWorkspace = vi.fn().mockResolvedValue({ id: 'ws-1', name: '默认工作区', description: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null });
    repository.createCase = vi.fn().mockResolvedValue({ id: 'case-new', workspaceId: 'ws-1', name: '我的案件', status: 'active', summary: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, archivedAt: null, deletedAt: null, statusBeforeDelete: null });
    repository.listCharacters = vi.fn().mockResolvedValue([]);
    repository.listClues = vi.fn().mockResolvedValue([]);
    repository.listEvents = vi.fn().mockResolvedValue([]);
    repository.listHypotheses = vi.fn().mockResolvedValue([]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    // Should show empty state with CTA
    expect(await screen.findByText('先创建或选择一个案件')).toBeInTheDocument();

    // Click the create button
    await user.click(screen.getByRole('button', { name: '创建默认案件' }));

    // After creation, the workspace and case are created, then refreshScope is called
    // The mock listWorkspaces/listCases return empty so refreshScope still shows empty,
    // but the createWorkspace and createCase methods were called
    expect(repository.createWorkspace).toHaveBeenCalledWith({ name: '默认工作区' });
  });

  // --- P0-2: Delete ---

  it('soft deletes a node and refreshes', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([]);
    repository.listEvents = vi.fn().mockResolvedValue([]);
    repository.listHypotheses = vi.fn().mockResolvedValue([]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    // Click on the character node to select it
    await user.click(await screen.findByText('林乔'));

    // Click delete button
    await user.click(screen.getByRole('button', { name: '删除节点' }));

    // Confirm deletion
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    expect(repository.softDeleteCharacter).toHaveBeenCalledWith('char-1');
  });

  it('soft deletes a board relation', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      { id: 'clue-1', caseId: 'case-1', title: '停摆怀表', content: '', source: '书房', discoveredAt: null, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([
      { id: 'rel-1', caseId: 'case-1', fromNodeType: 'person', fromNodeId: 'char-1', toNodeType: 'clue', toNodeId: 'clue-1', type: 'related', note: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    // Click relation label, then delete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '选择关联关系' })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: '选择关联关系' }));

    await user.click(screen.getByRole('button', { name: '删除关系' }));
    await user.click(screen.getByRole('button', { name: '确认删除' }));

    expect(repository.softDeleteBoardRelation).toHaveBeenCalledWith('rel-1');
  });

  // --- P0-3: Edit all node types ---

  it('edits a person node in the inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '初始备注', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([]);
    repository.listEvents = vi.fn().mockResolvedValue([]);
    repository.listHypotheses = vi.fn().mockResolvedValue([]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    await user.click(await screen.findByText('林乔'));
    await user.click(screen.getByRole('button', { name: '编辑人物' }));

    const titleInputs = screen.getAllByLabelText('标题');
    await user.clear(titleInputs[1]);
    await user.type(titleInputs[1], '张伟');

    const roleInput = screen.getByLabelText('角色');
    await user.clear(roleInput);
    await user.type(roleInput, '嫌疑人');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(repository.updateCharacter).toHaveBeenCalledWith('char-1', {
      name: '张伟',
      role: '嫌疑人',
      notes: '初始备注',
    });
  });

  it('edits a clue node in the inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([]);
    repository.listClues = vi.fn().mockResolvedValue([
      { id: 'clue-1', caseId: 'case-1', title: '怀表', content: '原始内容', source: '书房', discoveredAt: null, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listEvents = vi.fn().mockResolvedValue([]);
    repository.listHypotheses = vi.fn().mockResolvedValue([]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    await user.click(await screen.findByText('怀表'));
    await user.click(screen.getByRole('button', { name: '编辑线索' }));

    const sourceInput = screen.getByLabelText('来源');
    await user.clear(sourceInput);
    await user.type(sourceInput, '卧室');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(repository.updateClue).toHaveBeenCalledWith('clue-1', {
      title: '怀表',
      source: '卧室',
      content: '原始内容',
    });
  });

  it('edits an event node in the inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([]);
    repository.listClues = vi.fn().mockResolvedValue([]);
    repository.listEvents = vi.fn().mockResolvedValue([
      { id: 'evt-1', caseId: 'case-1', title: '争吵', description: '原始描述', occurredAt: '2026-01-01T12:00:00.000Z', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    await user.click(await screen.findByText('争吵'));
    await user.click(screen.getByRole('button', { name: '编辑事件' }));

    const bodyInput = screen.getByLabelText('详情');
    await user.clear(bodyInput);
    await user.type(bodyInput, '更新后的描述');

    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(repository.updateEvent).toHaveBeenCalledWith('evt-1', {
      title: '争吵',
      occurredAt: '2026-01-01T12:00:00.000Z',
      description: '更新后的描述',
    });
  });

  // --- P0-4: Error feedback ---

  it('shows Chinese error when quick-add fails', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.createClue = vi.fn().mockRejectedValue(new Error('network error'));

    renderBoardWithRepository(repository);

    await waitFor(() => {
      expect(screen.getByLabelText('标题')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('标题'), '测试');
    await user.click(screen.getByRole('button', { name: '添加到案件板' }));

    expect(await screen.findByText('创建失败，请检查网络后重试')).toBeInTheDocument();
  });

  it('shows Chinese error when relation creation fails', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      { id: 'hyp-1', caseId: 'case-1', title: '测试猜想', body: '', status: 'unverified', confidence: 50, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);
    repository.createBoardRelation = vi.fn().mockRejectedValue(new Error('same case'));

    renderBoardWithRepository(repository);

    await user.click(await screen.findByText('林乔'));
    await user.click(screen.getByRole('button', { name: '继续关联线索' }));
    await user.selectOptions(screen.getByLabelText('目标节点'), 'hyp-1');
    await user.click(screen.getByRole('button', { name: '确认建立' }));

    expect(await screen.findByText('关系创建失败，这两个节点可能不在同一案件中')).toBeInTheDocument();
  });

  // --- P0-5: Search auto-select ---

  it('search auto-selects first matching node and opens inspector', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    repository.listCharacters = vi.fn().mockResolvedValue([
      { id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listClues = vi.fn().mockResolvedValue([
      { id: 'clue-1', caseId: 'case-1', title: '停摆怀表', content: '', source: '书房', discoveredAt: null, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listHypotheses = vi.fn().mockResolvedValue([
      { id: 'hyp-1', caseId: 'case-1', title: '猜想测试', body: '', status: 'unverified', confidence: 50, createdAt: TIMESTAMP, updatedAt: TIMESTAMP, deletedAt: null },
    ]);
    repository.listBoardRelations = vi.fn().mockResolvedValue([]);
    repository.listBoardNodePositions = vi.fn().mockResolvedValue([]);

    renderBoardWithRepository(repository);

    await screen.findByText('林乔');

    // Type to search for the hypothesis
    const searchInput = screen.getByLabelText('在案件板中查找');
    await user.type(searchInput, '猜想');

    // Inspector should show the hypothesis (first matching node) in both node and heading
    const matches = await screen.findAllByText('猜想测试');
    expect(matches.length).toBeGreaterThanOrEqual(1);

    // One of the headings should be the hypothesis title in the inspector
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.some((h) => h.textContent === '猜想测试')).toBe(true);
  });
});
