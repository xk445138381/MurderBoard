import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardNodeType, BoardRelationType, HypothesisStatus } from '../../domain/types';
import { useMurderBoardRepository } from '../../shared/data/MurderBoardDataProvider';
import { formatActionError } from '../../shared/data/useWorkspaceCaseSelection';

export interface BoardViewNode {
  body: string;
  id: string;
  meta: string;
  status: string;
  title: string;
  type: BoardNodeType;
  x: number;
  y: number;
  hypothesisStatus?: HypothesisStatus;
  hypothesisConfidence?: number;
}

export interface BoardViewRelation {
  fromNodeId: string;
  id: string;
  note: string;
  toNodeId: string;
  type: BoardRelationType;
}

export type BoardDataStatus = 'loading' | 'ready' | 'empty' | 'error';

export function useBoardData(caseId: string | null) {
  const repository = useMurderBoardRepository();
  const [status, setStatus] = useState<BoardDataStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<BoardViewNode[]>([]);
  const [relations, setRelations] = useState<BoardViewRelation[]>([]);

  const refresh = useCallback(async () => {
    if (!caseId) {
      setNodes([]);
      setRelations([]);
      setStatus('empty');
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const [characters, clues, events, hypotheses, boardRelations, positions] = await Promise.all([
        repository.listCharacters(caseId),
        repository.listClues(caseId),
        repository.listEvents(caseId),
        repository.listHypotheses(caseId),
        repository.listBoardRelations(caseId),
        repository.listBoardNodePositions(caseId),
      ]);
      const positionByNode = new Map(
        positions.map((position) => [`${position.nodeType}:${position.nodeId}`, position]),
      );

      const nextNodes: BoardViewNode[] = [
        ...characters.map((character, index) => toBoardNode('person', character.id, character.name, character.role, character.notes, '已记录', index, positionByNode)),
        ...clues.map((clue, index) => toBoardNode('clue', clue.id, clue.title, clue.source, clue.content, '线索', index + characters.length, positionByNode)),
        ...events.map((event, index) => toBoardNode('event', event.id, event.title, event.occurredAt, event.description, '事件', index + characters.length + clues.length, positionByNode)),
        ...hypotheses.map((hypothesis, index) => toBoardNode(
          'hypothesis',
          hypothesis.id,
          hypothesis.title,
          statusLabel(hypothesis.status),
          hypothesis.body,
          `${hypothesis.confidence}%`,
          index + characters.length + clues.length + events.length,
          positionByNode,
          hypothesis.status,
          hypothesis.confidence,
        )),
      ];

      setNodes(nextNodes);
      setRelations(
        boardRelations.map((relation) => ({
          fromNodeId: relation.fromNodeId,
          id: relation.id,
          note: relation.note,
          toNodeId: relation.toNodeId,
          type: relation.type,
        })),
      );
      setStatus('ready');
    } catch (loadError) {
      setError(formatActionError(loadError));
      setStatus('error');
    }
  }, [caseId, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ error, nodes, refresh, relations, status }),
    [error, nodes, refresh, relations, status],
  );
}

function toBoardNode(
  type: BoardNodeType,
  id: string,
  title: string,
  meta: string,
  body: string,
  status: string,
  index: number,
  positionByNode: Map<string, { x: number; y: number }>,
  hypothesisStatus?: HypothesisStatus,
  hypothesisConfidence?: number,
): BoardViewNode {
  const position = positionByNode.get(`${type}:${id}`);
  return {
    body,
    id,
    meta,
    status,
    title,
    type,
    x: position?.x ?? 96 + (index % 3) * 272,
    y: position?.y ?? 96 + Math.floor(index / 3) * 156,
    ...(hypothesisStatus ? { hypothesisStatus } : {}),
    ...(hypothesisConfidence !== undefined ? { hypothesisConfidence } : {}),
  };
}

function statusLabel(status: string) {
  if (status === 'plausible') {
    return '较可信';
  }
  if (status === 'refuted') {
    return '被反驳';
  }
  return '待验证';
}
