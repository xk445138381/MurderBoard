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

  it('adds quick capture nodes to the board', async () => {
    const user = userEvent.setup();
    const repository = createDefaultFixture();

    renderBoardWithRepository(repository);

    await waitFor(() => {
      expect(screen.getByLabelText('标题')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('标题'), '藏起来的信');
    await user.click(screen.getByRole('button', { name: '添加到案件板' }));

    expect(repository.createClue).toHaveBeenCalledWith('case-1', { title: '藏起来的信' });
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
});
