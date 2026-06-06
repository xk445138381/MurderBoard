import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { MurderBoardRepository } from '../../storage/repositories';
import { MurderBoardDataProvider } from '../../shared/data/MurderBoardDataProvider';
import { useBoardData } from './useBoardData';

function wrapper(repository: MurderBoardRepository) {
  return function TestProvider({ children }: { children: ReactNode }) {
    return <MurderBoardDataProvider repository={repository}>{children}</MurderBoardDataProvider>;
  };
}

it('loads board nodes relations and positions for the selected case', async () => {
  const repository = {
    listCharacters: vi.fn().mockResolvedValue([{ id: 'char-1', caseId: 'case-1', name: '林乔', role: '目击者', notes: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }]),
    listClues: vi.fn().mockResolvedValue([{ id: 'clue-1', caseId: 'case-1', title: '停摆怀表', content: '', source: '书房', discoveredAt: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }]),
    listEvents: vi.fn().mockResolvedValue([]),
    listHypotheses: vi.fn().mockResolvedValue([{ id: 'hyp-1', caseId: 'case-1', title: '现场被提前布置', body: '', status: 'unverified', confidence: 50, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }]),
    listBoardRelations: vi.fn().mockResolvedValue([{ id: 'rel-1', caseId: 'case-1', fromNodeType: 'clue', fromNodeId: 'clue-1', toNodeType: 'hypothesis', toNodeId: 'hyp-1', type: 'supports', note: '支持猜想', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null }]),
    listBoardNodePositions: vi.fn().mockResolvedValue([{ id: 'case-1:clue:clue-1', caseId: 'case-1', nodeType: 'clue', nodeId: 'clue-1', x: 320, y: 120, updatedAt: '2026-01-01T00:00:00.000Z' }]),
  } as unknown as MurderBoardRepository;

  const { result } = renderHook(() => useBoardData('case-1'), {
    wrapper: wrapper(repository),
  });

  await waitFor(() => expect(result.current.status).toBe('ready'));
  expect(result.current.nodes.map((node) => node.title)).toEqual([
    '林乔',
    '停摆怀表',
    '现场被提前布置',
  ]);
  expect(result.current.relations).toHaveLength(1);
  expect(result.current.nodes.find((node) => node.id === 'clue-1')).toMatchObject({ x: 320, y: 120 });
});
