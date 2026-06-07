# 案件板业务逻辑与数据层接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前中文案件板 UI shell 接入真实领域模型和本地 IndexedDB repository，让人物、线索、事件、猜想、关系和节点位置可以创建、查询、编辑、软删除、保存和恢复。

**Architecture:** 保持本地优先 IndexedDB 路线，不引入账号、后端、实时同步或附件能力。领域层定义一等对象，repository 层负责校验和持久化，Board UI 只通过 repository hook 读写当前案件数据。首屏仍必须是全屏可视化案件板，现有列表页只作为辅助管理入口。

**Tech Stack:** React 19、React Router 7、TypeScript、Vite、Vitest、Testing Library、fake-indexeddb、IndexedDB。画布可继续使用当前 SVG/absolute shell；如网络稳定并安装成功，后续可单独引入 `@xyflow/react`，但本计划不要求新增依赖。

---

## 方向边界

- 首版用户是桌游玩家个人，不是主持人、创作者或多人协作团队。
- 玩家只记录自己已知信息、猜想和怀疑对象，不保存主持人答案或完整真相。
- 主界面必须是 `Board`，不是 `Cases` 列表，也不是表单后台。
- 快速录入只能要求最少字段；详细编辑放在 Inspector。
- 关系类型只能是 `related`、`supports`、`refutes`、`sequence`、`suspect`。
- 删除默认软删除；默认查询不返回软删除数据。
- 关系只能连接同一案件内的有效节点。删除节点后，关系查询和 UI 渲染不能崩溃。
- 节点位置是案件板体验的一部分，必须持久化。

## 文件结构

- Modify: `src/domain/types.ts`
  - 增加 `BoardNodeType`、`BoardRelationType`、`HypothesisStatus`、`Hypothesis`、`BoardRelation`、`BoardNodePosition`。
  - 增加类型守卫：`isBoardNodeType`、`isBoardRelationType`、`isHypothesisStatus`。
- Modify: `src/domain/types.test.ts`
  - 覆盖新增枚举和类型守卫。
- Modify: `src/storage/repositories/murder-board-repository.ts`
  - 增加猜想、案件板关系、节点位置的输入类型和 repository 方法。
- Modify: `src/storage/indexeddb/object-stores.ts`
  - 升级 IndexedDB version。
  - 增加 `hypotheses`、`boardRelations`、`boardNodePositions` stores 和索引。
- Modify: `src/storage/indexeddb/indexed-db-murder-board-repository.ts`
  - 实现新增 repository 方法。
  - 把删除节点后的关系处理固定为“关系保留但查询可标记缺失节点；默认 Board 查询不因缺失崩溃”。
- Modify: `src/storage/indexeddb/indexed-db-murder-board-repository.test.ts`
  - 覆盖猜想 CRUD、关系校验、位置保存和软删除过滤。
- Modify: `src/features/board/BoardPage.tsx`
  - 当前 mock 数据替换为 repository 数据。
  - 快速录入调用真实 create 方法。
  - 搜索、关系筛选、Inspector 保持当前中文 UI 语义。
- Modify: `src/features/board/BoardPage.test.tsx`
  - 使用 fake repository 测 Board 数据加载、快速录入、搜索、关系选择。
- Do not modify unless required: `docs/product-requirements.md`、`docs/ui-design-direction.md`、`docs/design-review-gate.md`
  - 这些是背景约束来源，不是实现草稿。执行本计划时即使打不开这些文件，也必须遵守本文档内联的方向边界和 Task 7 设计 gate。

---

### Task 1: 领域类型和守卫

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/types.test.ts`

- [ ] **Step 1: 写失败测试**

Add to `src/domain/types.test.ts`:

```ts
import {
  BOARD_NODE_TYPES,
  BOARD_RELATION_TYPES,
  HYPOTHESIS_STATUSES,
  isBoardNodeType,
  isBoardRelationType,
  isHypothesisStatus,
} from './types';

describe('board domain types', () => {
  it('defines the first-version board node types', () => {
    expect(BOARD_NODE_TYPES).toEqual(['person', 'clue', 'event', 'hypothesis']);
    expect(isBoardNodeType('person')).toBe(true);
    expect(isBoardNodeType('clue')).toBe(true);
    expect(isBoardNodeType('event')).toBe(true);
    expect(isBoardNodeType('hypothesis')).toBe(true);
    expect(isBoardNodeType('workspace')).toBe(false);
  });

  it('defines semantic board relation types', () => {
    expect(BOARD_RELATION_TYPES).toEqual([
      'related',
      'supports',
      'refutes',
      'sequence',
      'suspect',
    ]);
    expect(isBoardRelationType('supports')).toBe(true);
    expect(isBoardRelationType('refutes')).toBe(true);
    expect(isBoardRelationType('unknown')).toBe(false);
  });

  it('defines hypothesis statuses as player-owned reasoning states', () => {
    expect(HYPOTHESIS_STATUSES).toEqual(['unverified', 'plausible', 'refuted']);
    expect(isHypothesisStatus('unverified')).toBe(true);
    expect(isHypothesisStatus('solved')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/types.test.ts`

Expected: FAIL because `BOARD_NODE_TYPES`, `BOARD_RELATION_TYPES`, `HYPOTHESIS_STATUSES`, `isBoardNodeType`, `isBoardRelationType`, and `isHypothesisStatus` are not exported yet.

- [ ] **Step 3: 实现最小领域类型**

Add to `src/domain/types.ts` near the existing enum constants:

```ts
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
```

Add after `Event`:

```ts
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
```

Add near existing type guards:

```ts
export function isBoardNodeType(value: string): value is BoardNodeType {
  return BOARD_NODE_TYPES.includes(value as BoardNodeType);
}

export function isBoardRelationType(value: string): value is BoardRelationType {
  return BOARD_RELATION_TYPES.includes(value as BoardRelationType);
}

export function isHypothesisStatus(value: string): value is HypothesisStatus {
  return HYPOTHESIS_STATUSES.includes(value as HypothesisStatus);
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/domain/types.test.ts`

Expected: PASS.

- [ ] **Step 5: 提交**

```bash
git add src/domain/types.ts src/domain/types.test.ts
git commit -m "feat: add board domain types"
```

---

### Task 2: Repository 接口扩展

**Files:**
- Modify: `src/storage/repositories/murder-board-repository.ts`

- [ ] **Step 1: 增加 repository 输入类型**

Add imports:

```ts
import type {
  BoardNodePosition,
  BoardNodeType,
  BoardRelation,
  BoardRelationType,
  Hypothesis,
  HypothesisStatus,
} from '../../domain/types';
```

Add these interfaces after `UpdateEventInput`:

```ts
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
```

- [ ] **Step 2: 增加 repository 方法**

Add to `MurderBoardRepository` after event methods:

```ts
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
```

- [ ] **Step 3: 类型检查确认实现还未跟上**

Run: `npm run build`

Expected: FAIL because `IndexedDbMurderBoardRepository` does not implement the new methods yet.

- [ ] **Step 4: 不提交**

Do not commit this task alone unless the implementation task follows immediately in the same branch. The repository interface is intentionally red until Task 3 and Task 4 implement it.

---

### Task 3: IndexedDB stores 和迁移

**Files:**
- Modify: `src/storage/indexeddb/object-stores.ts`
- Modify: `src/storage/indexeddb/indexed-db-client.test.ts`

- [ ] **Step 1: 写失败测试**

Add to `src/storage/indexeddb/indexed-db-client.test.ts`:

```ts
it('creates board stores required by the cases board MVP', async () => {
  const client = new IndexedDbClient({
    databaseName: `murderboard-test-${crypto.randomUUID()}`,
  });

  const db = await client.init();

  expect([...db.objectStoreNames]).toEqual(
    expect.arrayContaining(['hypotheses', 'boardRelations', 'boardNodePositions']),
  );
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/storage/indexeddb/indexed-db-client.test.ts`

Expected: FAIL because the new object stores do not exist.

- [ ] **Step 3: 增加 stores 和索引**

Modify `src/storage/indexeddb/object-stores.ts`:

```ts
export const INDEXED_DB_VERSION = 3;
```

Add the stores to `OBJECT_STORES`:

```ts
  'hypotheses',
  'boardRelations',
  'boardNodePositions',
```

Add index definitions:

```ts
  hypotheses: [
    { name: 'caseId', keyPath: 'caseId' },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
  boardRelations: [
    { name: 'caseId', keyPath: 'caseId' },
    { name: 'fromNode', keyPath: ['fromNodeType', 'fromNodeId'] },
    { name: 'toNode', keyPath: ['toNodeType', 'toNodeId'] },
    { name: 'deletedAt', keyPath: 'deletedAt' },
  ],
  boardNodePositions: [
    { name: 'caseId', keyPath: 'caseId' },
    { name: 'caseNode', keyPath: ['caseId', 'nodeType', 'nodeId'], options: { unique: true } },
  ],
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/storage/indexeddb/indexed-db-client.test.ts`

Expected: PASS.

---

### Task 4: Repository 实现和存储测试

**Files:**
- Modify: `src/storage/indexeddb/indexed-db-murder-board-repository.ts`
- Modify: `src/storage/indexeddb/indexed-db-murder-board-repository.test.ts`

- [ ] **Step 1: 写猜想 CRUD 失败测试**

Add to `src/storage/indexeddb/indexed-db-murder-board-repository.test.ts`:

```ts
it('creates updates soft deletes and restores hypotheses', async () => {
  const repository = createRepository();
  const workspace = await repository.createWorkspace({ name: '渡鸦宅邸' });
  const caseRecord = await repository.createCase(workspace.id, { name: '第一幕', status: 'active' });

  const hypothesis = await repository.createHypothesis(caseRecord.id, {
    title: '现场被提前布置',
    body: '房间可能在众人进入前就已经被布置过。',
  });

  expect(hypothesis.status).toBe('unverified');
  expect(hypothesis.confidence).toBe(50);

  const updated = await repository.updateHypothesis(hypothesis.id, {
    status: 'plausible',
    confidence: 70,
  });
  expect(updated.status).toBe('plausible');
  expect(updated.confidence).toBe(70);

  await repository.softDeleteHypothesis(hypothesis.id);
  await expect(repository.listHypotheses(caseRecord.id)).resolves.toEqual([]);
  await expect(repository.listHypotheses(caseRecord.id, { includeDeleted: true })).resolves.toHaveLength(1);

  const restored = await repository.restoreHypothesis(hypothesis.id);
  expect(restored.deletedAt).toBeNull();
  await expect(repository.listHypotheses(caseRecord.id)).resolves.toHaveLength(1);
});
```

- [ ] **Step 2: 写关系校验失败测试**

Add:

```ts
it('only creates board relations between valid nodes in the same case', async () => {
  const repository = createRepository();
  const workspace = await repository.createWorkspace({ name: '渡鸦宅邸' });
  const caseA = await repository.createCase(workspace.id, { name: '第一幕', status: 'active' });
  const caseB = await repository.createCase(workspace.id, { name: '第二幕', status: 'active' });
  const clue = await repository.createClue(caseA.id, { title: '停摆怀表' });
  const hypothesis = await repository.createHypothesis(caseA.id, { title: '现场被提前布置' });
  const otherHypothesis = await repository.createHypothesis(caseB.id, { title: '另一个案件的猜想' });

  await expect(
    repository.createBoardRelation(caseA.id, {
      fromNodeType: 'clue',
      fromNodeId: clue.id,
      toNodeType: 'hypothesis',
      toNodeId: hypothesis.id,
      type: 'supports',
      note: '停摆时间支持提前布置。',
    }),
  ).resolves.toMatchObject({ type: 'supports', note: '停摆时间支持提前布置。' });

  await expect(
    repository.createBoardRelation(caseA.id, {
      fromNodeType: 'clue',
      fromNodeId: clue.id,
      toNodeType: 'hypothesis',
      toNodeId: otherHypothesis.id,
      type: 'supports',
    }),
  ).rejects.toThrow(/same case/i);
});
```

- [ ] **Step 3: 写节点位置失败测试**

Add:

```ts
it('saves and replaces board node positions per case node', async () => {
  const repository = createRepository();
  const workspace = await repository.createWorkspace({ name: '渡鸦宅邸' });
  const caseRecord = await repository.createCase(workspace.id, { name: '第一幕', status: 'active' });
  const character = await repository.createCharacter(caseRecord.id, { name: '林乔' });

  await repository.saveBoardNodePosition(caseRecord.id, {
    nodeType: 'person',
    nodeId: character.id,
    x: 80,
    y: 120,
  });
  await repository.saveBoardNodePosition(caseRecord.id, {
    nodeType: 'person',
    nodeId: character.id,
    x: 160,
    y: 240,
  });

  await expect(repository.listBoardNodePositions(caseRecord.id)).resolves.toMatchObject([
    { nodeType: 'person', nodeId: character.id, x: 160, y: 240 },
  ]);
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npx vitest run src/storage/indexeddb/indexed-db-murder-board-repository.test.ts`

Expected: FAIL because methods are missing.

- [ ] **Step 5: 实现 repository 方法**

In `src/storage/indexeddb/indexed-db-murder-board-repository.ts`:

- Import the new domain types and repository input types.
- Extend `StoredRecord` with `Hypothesis | BoardRelation | BoardNodePosition`.
- Implement methods using the existing helper style: `requireCase`, `getAllByIndex`, `addRecord`, `putRecord`, `deleteRecord`, `currentTimestamp`.
- Validate `confidence` as a number between `0` and `100`.
- Default hypothesis values:

```ts
body: normalizeOptionalText(input.body),
status: input.status ?? 'unverified',
confidence: input.confidence ?? 50,
```

- For board relation validation, create a helper:

```ts
private async requireBoardNode(caseId: string, nodeType: BoardNodeType, nodeId: string) {
  if (nodeType === 'person') {
    const record = await this.getRecord<Character>('characters', nodeId);
    if (!record || record.deletedAt || record.caseId !== caseId) {
      throw new StorageValidationError('Board relation nodes must exist in the same case.', {
        caseId,
        nodeType,
        nodeId,
      });
    }
    return;
  }

  if (nodeType === 'clue') {
    const record = await this.getRecord<Clue>('clues', nodeId);
    if (!record || record.deletedAt || record.caseId !== caseId) {
      throw new StorageValidationError('Board relation nodes must exist in the same case.', {
        caseId,
        nodeType,
        nodeId,
      });
    }
    return;
  }

  if (nodeType === 'event') {
    const record = await this.getRecord<CaseEvent>('events', nodeId);
    if (!record || record.deletedAt || record.caseId !== caseId) {
      throw new StorageValidationError('Board relation nodes must exist in the same case.', {
        caseId,
        nodeType,
        nodeId,
      });
    }
    return;
  }

  const record = await this.getRecord<Hypothesis>('hypotheses', nodeId);
  if (!record || record.deletedAt || record.caseId !== caseId) {
    throw new StorageValidationError('Board relation nodes must exist in the same case.', {
      caseId,
      nodeType,
      nodeId,
    });
  }
}
```

- Use position id format:

```ts
const id = `${caseId}:${input.nodeType}:${input.nodeId}`;
```

- [ ] **Step 6: 运行存储测试确认通过**

Run: `npx vitest run src/storage/indexeddb/indexed-db-murder-board-repository.test.ts`

Expected: PASS.

- [ ] **Step 7: 运行构建确认接口一致**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 8: 提交**

```bash
git add src/domain/types.ts src/domain/types.test.ts src/storage/repositories/murder-board-repository.ts src/storage/indexeddb/object-stores.ts src/storage/indexeddb/indexed-db-client.test.ts src/storage/indexeddb/indexed-db-murder-board-repository.ts src/storage/indexeddb/indexed-db-murder-board-repository.test.ts
git commit -m "feat: persist board hypotheses relations and positions"
```

---

### Task 5: Board 数据读取 hook

**Files:**
- Create: `src/features/board/useBoardData.ts`
- Create: `src/features/board/useBoardData.test.tsx`

- [ ] **Step 1: 写失败测试**

Create `src/features/board/useBoardData.test.tsx`:

```tsx
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/features/board/useBoardData.test.tsx`

Expected: FAIL because `useBoardData` does not exist.

- [ ] **Step 3: 实现 hook**

Create `src/features/board/useBoardData.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BoardNodeType, BoardRelationType } from '../../domain/types';
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
        ...hypotheses.map((hypothesis, index) => toBoardNode('hypothesis', hypothesis.id, hypothesis.title, statusLabel(hypothesis.status), hypothesis.body, `${hypothesis.confidence}%`, index + characters.length + clues.length + events.length, positionByNode)),
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/features/board/useBoardData.test.tsx`

Expected: PASS.

---

### Task 6: Board 页面接入真实数据

**Files:**
- Modify: `src/features/board/BoardPage.tsx`
- Modify: `src/features/board/BoardPage.test.tsx`

- [ ] **Step 1: 写 UI 失败测试**

In `src/features/board/BoardPage.test.tsx`, add a fake repository wrapper and assert that the page renders repository data instead of `INITIAL_NODES`:

```tsx
import type { ReactNode } from 'react';
import { MurderBoardDataProvider } from '../../shared/data/MurderBoardDataProvider';
import type { MurderBoardRepository } from '../../storage/repositories';

const timestamp = '2026-01-01T00:00:00.000Z';

function createBoardRepositoryFixture() {
  return {
    listWorkspaces: vi.fn().mockResolvedValue([
      {
        id: 'workspace-1',
        name: '渡鸦宅邸',
        description: '',
        createdAt: timestamp,
        updatedAt: timestamp,
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
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: null,
        deletedAt: null,
        statusBeforeDelete: null,
      },
    ]),
    listCharacters: vi.fn().mockResolvedValue([
      {
        id: 'char-1',
        caseId: 'case-1',
        name: '林乔',
        role: '目击者',
        notes: '主动提到怀表',
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    ]),
    listClues: vi.fn().mockResolvedValue([
      {
        id: 'clue-1',
        caseId: 'case-1',
        title: '停摆怀表',
        source: '书房',
        content: '停在 23:48',
        discoveredAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    ]),
    listEvents: vi.fn().mockResolvedValue([]),
    listHypotheses: vi.fn().mockResolvedValue([
      {
        id: 'hyp-1',
        caseId: 'case-1',
        title: '现场被提前布置',
        body: '房间可能提前被布置',
        status: 'unverified',
        confidence: 50,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    ]),
    listBoardRelations: vi.fn().mockResolvedValue([
      {
        id: 'rel-1',
        caseId: 'case-1',
        fromNodeType: 'clue',
        fromNodeId: 'clue-1',
        toNodeType: 'hypothesis',
        toNodeId: 'hyp-1',
        type: 'supports',
        note: '支持提前布置',
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      },
    ]),
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

it('renders board data from the repository for the selected case', async () => {
  renderBoardWithRepository(createBoardRepositoryFixture());

  expect(await screen.findByText('林乔')).toBeInTheDocument();
  expect(screen.getByText('停摆怀表')).toBeInTheDocument();
  expect(screen.getByText('现场被提前布置')).toBeInTheDocument();
});
```

Use the existing test helper style in the file. Do not assert implementation details such as exact pixel positions.

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/features/board/BoardPage.test.tsx`

Expected: FAIL because the component still uses mock constants.

- [ ] **Step 3: 接入 hook 和当前案件选择**

In `src/features/board/BoardPage.tsx`:

- Import:

```ts
import { useWorkspaceCaseSelection } from '../../shared/data/useWorkspaceCaseSelection';
import { useBoardData } from './useBoardData';
```

- Replace `useState(INITIAL_NODES)` and `INITIAL_RELATIONS` reads with `useBoardData(selectedCaseId)`.
- Keep `NODE_TYPE_LABELS` and `RELATION_LABELS` in the UI file or move them to a small `board-labels.ts`; do not change Chinese wording.
- For no selected case, show a Chinese empty state in the board area:

```tsx
<div className="board-empty-state">
  <p className="board-kicker">案件板</p>
  <h2>先创建或选择一个案件</h2>
  <p>案件板会记录你在本局游戏中已经知道的人物、线索、事件和猜想。</p>
</div>
```

- For loading, show:

```tsx
<div className="board-empty-state">
  <p className="board-kicker">案件板</p>
  <h2>正在整理案件板</h2>
</div>
```

- [ ] **Step 4: 快速录入调用 repository**

In `handleQuickAdd`:

- `person` -> `repository.createCharacter(selectedCaseId, { name: title })`
- `clue` -> `repository.createClue(selectedCaseId, { title })`
- `event` -> `repository.createEvent(selectedCaseId, { title, occurredAt: new Date().toISOString() })`
- `hypothesis` -> `repository.createHypothesis(selectedCaseId, { title })`
- After create, call `refresh()` from `useBoardData`.
- Keep form fields minimal: type + title only.

- [ ] **Step 5: 运行 Board UI 测试**

Run: `npx vitest run src/features/board/BoardPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: 提交**

```bash
git add src/features/board/BoardPage.tsx src/features/board/BoardPage.test.tsx src/features/board/useBoardData.ts src/features/board/useBoardData.test.tsx
git commit -m "feat: load board data from repository"
```

---

### Task 7: 回归和设计 gate

**Files:**
- Modify only if tests reveal real issues.

- [ ] **Step 1: 运行完整测试**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: 运行源码定向测试**

Run:

```bash
npx vitest run src
```

Expected: PASS and it must not scan `.worktrees`.

- [ ] **Step 3: 运行生产构建**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: 本地预览**

Run:

```bash
npm run dev
```

Open: `http://127.0.0.1:5173/board`

Expected:

- 第一屏仍然是全屏案件板。
- 顶部命令栏、左侧快速录入、中间画布、右侧检查器都在。
- UI 文案仍是中文。
- 快速录入新建节点后，刷新页面数据仍存在。
- 关系筛选仍显示 `全部`、`关联`、`支持`、`反驳`、`顺序`、`嫌疑`。
- 画布没有退化成列表或表格后台。

- [ ] **Step 5: 执行内联设计 gate**

Use this gate directly. Do not require another file.

Blocking issues. If any item is true, the implementation is not ready:

- 默认第一屏不是案件板。
- 画布不是主视觉，只是列表页或表单页里的小组件。
- 不能在同一页面完成创建节点、建立关系和查看详情。
- 四类节点视觉不可区分：人物、线索、事件、猜想必须一眼可分。
- 五类关系语义不可区分：`related`、`supports`、`refutes`、`sequence`、`suspect` 必须有清楚颜色或线型区别。
- 节点文字明显溢出、遮挡或压住其他 UI。
- 深色背景下文字、关系线或选中态对比度不足。
- 快速录入变成长表单，明显打断游戏节奏。
- 视觉风格偏恐怖片、血腥、营销页或普通 CRUD 后台。
- UI 文案回到英文或后台术语，尤其是 record、entity、operation、CRUD、management。

Score the UI from 0 to 16. A score below 13 is not ready:

```text
案件板主导性：0 画布弱 / 1 画布可见但不主导 / 2 画布明确主导
临场录入效率：0 字段过重 / 1 勉强可用 / 2 快速、短、不中断
节点识别：0 类型难分 / 1 需细看 / 2 一眼可分
关系语义：0 无语义 / 1 部分清楚 / 2 清楚且可筛选
搜索找回：0 不明显 / 1 可搜索但定位弱 / 2 能快速定位
Inspector：0 遮挡或缺失 / 1 可用但拥挤 / 2 清楚且不压迫画布
响应式：0 平板明显坏 / 1 基本可用 / 2 桌面和平板都稳定
视觉基调：0 偏离方向 / 1 大体接近 / 2 冷静调查桌面成立
```

Walk this task flow in the running app:

1. 创建一个人物。
2. 创建一个线索。
3. 创建一个事件。
4. 创建一个猜想。
5. 建立 `supports` 关系。
6. 建立 `refutes` 关系。
7. 搜索刚创建的猜想并定位到画布。
8. 在 Inspector 中修改该猜想。

Expected:

- 全流程不需要离开案件板。
- 没有明显布局跳动。
- 操作结果在画布上立即可见。
- 玩家能理解当前选中的节点或关系。

Report the result in this format:

```text
Design gate: Pass / Blocked
Score: X/16
Blocking issues:
- ...
Required fixes:
- ...
Nice-to-have:
- ...
```

- [ ] **Step 6: 提交最终回归修复**

Only if Step 1-4 required changes:

```bash
git add src/features/board/BoardPage.tsx src/features/board/BoardPage.test.tsx src/features/board/useBoardData.ts src/features/board/useBoardData.test.tsx src/storage/indexeddb/indexed-db-murder-board-repository.ts src/storage/indexeddb/indexed-db-murder-board-repository.test.ts
git commit -m "fix: keep board data integration aligned with design gate"
```

---

## 自审结果

- Spec coverage: 覆盖 PRD 中的猜想、类型化关系、节点位置、本地优先、快速录入、搜索/Inspector 接入前置数据能力。
- Placeholder scan: 本计划没有使用占位式任务。实现步骤均给出文件、命令、预期结果或代码片段。
- Type consistency: `person | clue | event | hypothesis` 和 `related | supports | refutes | sequence | suspect` 在领域、repository、Board hook 中保持一致。
- Intent lock: 后续 agent 不应新增主持人真相、多人协作、附件/OCR、营销页或后台化主屏。
