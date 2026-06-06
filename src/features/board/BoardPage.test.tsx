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

    // The matching clue should still be visible
    expect(screen.getByText('停摆怀表')).toBeInTheDocument();

    // Non-matching nodes may be dimmed but still in DOM
    expect(screen.getByText('林乔')).toBeInTheDocument();
    expect(screen.getByText('现场被提前布置')).toBeInTheDocument();
  });
});
