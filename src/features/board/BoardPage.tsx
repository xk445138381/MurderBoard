import { useMemo, useState, type FormEvent } from 'react';
import { useBoardData } from './useBoardData';
import { useWorkspaceCaseSelection } from '../../shared/data/useWorkspaceCaseSelection';
import { useMurderBoardRepository } from '../../shared/data/MurderBoardDataProvider';
import type { BoardNodeType, BoardRelationType } from '../../domain/types';

const NODE_TYPES: BoardNodeType[] = ['person', 'clue', 'event', 'hypothesis'];
const RELATION_TYPES: BoardRelationType[] = ['related', 'supports', 'refutes', 'sequence', 'suspect'];

const NODE_TYPE_LABELS: Record<BoardNodeType, string> = {
  person: '人物',
  clue: '线索',
  event: '事件',
  hypothesis: '猜想',
};

const RELATION_LABELS: Record<BoardRelationType, string> = {
  related: '关联',
  supports: '支持',
  refutes: '反驳',
  sequence: '顺序',
  suspect: '嫌疑',
};

export function BoardPage() {
  const repository = useMurderBoardRepository();
  const { isLoadingScope, selectedCaseId } = useWorkspaceCaseSelection();
  const {
    error: boardError,
    nodes,
    refresh,
    relations,
    status: boardStatus,
  } = useBoardData(selectedCaseId);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [relationFilter, setRelationFilter] = useState<BoardRelationType | 'all'>('all');
  const [quickType, setQuickType] = useState<BoardNodeType>('clue');
  const [quickTitle, setQuickTitle] = useState('');

  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const matchingNodeIds = useMemo(() => {
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
      return new Set(nodes.map((node) => node.id));
    }

    return new Set(
      nodes
        .filter((node) =>
          [node.title, node.meta, node.body, node.status, NODE_TYPE_LABELS[node.type]]
            .some((value) => normalizeQuery(value).includes(normalizedQuery)),
        )
        .map((node) => node.id),
    );
  }, [nodes, query]);
  const visibleRelations = useMemo(
    () => relations.filter(
      (relation) => relationFilter === 'all' || relation.type === relationFilter,
    ),
    [relations, relationFilter],
  );
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const selectedRelation =
    selectedRelationId ? relations.find((relation) => relation.id === selectedRelationId) ?? null : null;

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedRelationId(null);
  }

  function selectRelation(relationId: string) {
    setSelectedRelationId(relationId);
    setSelectedNodeId(null);
  }

  async function handleQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = quickTitle.trim();

    if (!title || !selectedCaseId) {
      return;
    }

    try {
      switch (quickType) {
        case 'person':
          await repository.createCharacter(selectedCaseId, { name: title });
          break;
        case 'clue':
          await repository.createClue(selectedCaseId, { title });
          break;
        case 'event':
          await repository.createEvent(selectedCaseId, {
            title,
            occurredAt: new Date().toISOString(),
          });
          break;
        case 'hypothesis':
          await repository.createHypothesis(selectedCaseId, { title });
          break;
      }
      setQuickTitle('');
      void refresh();
    } catch {
      // Repository error; board remains usable
    }
  }

  return (
    <section aria-labelledby="board-title" className="board-page">
      <header className="board-command-bar">
        <div>
          <p className="board-kicker">个人推理案件板</p>
          <h1 id="board-title">MurderBoard</h1>
        </div>
        <label className="board-search">
          <span>在案件板中查找</span>
          <input
            aria-label="在案件板中查找"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索线索、嫌疑人、猜想"
            value={query}
          />
        </label>
        <div className="relation-filter" aria-label="关系筛选">
          <button
            className={relationFilter === 'all' ? 'active' : ''}
            onClick={() => setRelationFilter('all')}
            type="button"
          >
            全部
          </button>
          {RELATION_TYPES.map((relationType) => (
            <button
              className={relationFilter === relationType ? 'active' : ''}
              data-relation={relationType}
              key={relationType}
              onClick={() => setRelationFilter(relationType)}
              type="button"
            >
              {RELATION_LABELS[relationType]}
            </button>
          ))}
        </div>
      </header>

      <div className="board-workbench">
        <aside className="quick-capture" aria-label="快速录入">
          <div>
            <p className="board-kicker">快速录入</p>
            <h2>记录已知信息</h2>
            <p className="quick-capture-copy">
              先写短条目，等桌面节奏慢下来再补充细节。
            </p>
          </div>
          <form className="quick-capture-form" onSubmit={handleQuickAdd}>
            <label htmlFor="quick-node-type">类型</label>
            <select
              id="quick-node-type"
              onChange={(event) => setQuickType(event.target.value as BoardNodeType)}
              value={quickType}
            >
              {NODE_TYPES.map((nodeType) => (
                <option key={nodeType} value={nodeType}>
                  {NODE_TYPE_LABELS[nodeType]}
                </option>
              ))}
            </select>
            <label htmlFor="quick-node-title">标题</label>
            <input
              id="quick-node-title"
              onChange={(event) => setQuickTitle(event.target.value)}
              placeholder="例如：缺失的钥匙"
              value={quickTitle}
            />
            <button type="submit">添加到案件板</button>
          </form>
          <div className="capture-shortcuts" aria-label="节点类型指南">
            {NODE_TYPES.map((nodeType) => (
              <button
                className={quickType === nodeType ? 'active' : ''}
                key={nodeType}
                onClick={() => setQuickType(nodeType)}
                type="button"
              >
                <span className={`node-dot node-dot--${nodeType}`} />
                {NODE_TYPE_LABELS[nodeType]}
              </button>
            ))}
          </div>
          <div className="quick-sets" aria-label="快速视图">
            <p className="board-kicker">快速视图</p>
            <button type="button">
              <strong>矛盾点</strong>
              <span>只看反驳关系和未确认猜想</span>
            </button>
            <button type="button">
              <strong>嫌疑图</strong>
              <span>查看和未解猜想有关的人物</span>
            </button>
          </div>
          <div className="link-legend" aria-label="关系颜色图例">
            <p className="board-kicker">关系颜色</p>
            {RELATION_TYPES.map((relationType) => (
              <span key={relationType} data-relation={relationType}>
                {RELATION_LABELS[relationType]}
              </span>
            ))}
          </div>
        </aside>

        <div className="case-board" aria-label="可视化案件板">
          {renderBoardContent(
            isLoadingScope,
            boardStatus,
            selectedCaseId,
            boardError,
            nodes,
            nodeById,
            visibleRelations,
            selectedNodeId,
            matchingNodeIds,
            selectedRelationId,
            selectNode,
            selectRelation,
          )}
        </div>

        <aside className="board-inspector" aria-label="检查器">
          {selectedRelation ? (
            <RelationInspector relation={selectedRelation} nodeById={nodeById} />
          ) : selectedNode ? (
            <NodeInspector node={selectedNode} relations={relations} nodeById={nodeById} />
          ) : (
            <div className="inspector-empty">
              <p className="board-kicker">检查器</p>
              <h2>选择一个节点或关系</h2>
              <p>让当前推理一直留在视野里，游戏推进时也不会丢线索。</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function renderBoardContent(
  isLoadingScope: boolean,
  boardStatus: string,
  selectedCaseId: string | null,
  boardError: string | null,
  nodes: Array<{
    body: string;
    id: string;
    meta: string;
    status: string;
    title: string;
    type: BoardNodeType;
    x: number;
    y: number;
  }>,
  nodeById: Map<string, {
    body: string;
    id: string;
    meta: string;
    status: string;
    title: string;
    type: BoardNodeType;
    x: number;
    y: number;
  }>,
  visibleRelations: Array<{
    fromNodeId: string;
    id: string;
    note: string;
    toNodeId: string;
    type: BoardRelationType;
  }>,
  selectedNodeId: string | null,
  matchingNodeIds: Set<string>,
  selectedRelationId: string | null,
  selectNode: (nodeId: string) => void,
  selectRelation: (relationId: string) => void,
) {
  if (isLoadingScope || boardStatus === 'loading') {
    return (
      <div className="board-empty-state">
        <p className="board-kicker">案件板</p>
        <h2>正在整理案件板</h2>
      </div>
    );
  }

  if (!selectedCaseId) {
    return (
      <div className="board-empty-state">
        <p className="board-kicker">案件板</p>
        <h2>先创建或选择一个案件</h2>
        <p>案件板会记录你在本局游戏中已经知道的人物、线索、事件和猜想。</p>
      </div>
    );
  }

  if (boardStatus === 'error') {
    return (
      <div className="board-empty-state">
        <p className="board-kicker">案件板</p>
        <h2>加载案件板时出错</h2>
        {boardError ? <p>{boardError}</p> : null}
      </div>
    );
  }

  return (
    <>
      <div className="board-canvas-heading">
        <div>
          <h2>渡鸦宅邸案件板</h2>
          <p>整理玩家已知、怀疑和可以推翻的证据关系。</p>
        </div>
        <div className="board-stats" aria-label="案件板统计">
          <span>{nodes.length} 个节点</span>
          <span>{visibleRelations.length} 条关系</span>
        </div>
      </div>
      <svg className="relationship-layer" viewBox="0 0 980 640" aria-hidden="true">
        {visibleRelations.map((relation) => {
          const fromNode = nodeById.get(relation.fromNodeId);
          const toNode = nodeById.get(relation.toNodeId);

          if (!fromNode || !toNode) {
            return null;
          }

          return (
            <line
              className={`relation-line relation-line--${relation.type} ${
                relation.id === selectedRelationId ? 'relation-line--selected' : ''
              }`}
              key={relation.id}
              x1={fromNode.x + 108}
              x2={toNode.x + 108}
              y1={fromNode.y + 54}
              y2={toNode.y + 54}
            />
          );
        })}
      </svg>
      {visibleRelations.map((relation) => {
        const fromNode = nodeById.get(relation.fromNodeId);
        const toNode = nodeById.get(relation.toNodeId);

        if (!fromNode || !toNode) {
          return null;
        }

        return (
          <button
            className={`relation-label relation-label--${relation.type}`}
            key={relation.id}
            aria-label={`选择${RELATION_LABELS[relation.type]}关系`}
            onClick={() => selectRelation(relation.id)}
            style={{
              left: `${(fromNode.x + toNode.x) / 2 + 60}px`,
              top: `${(fromNode.y + toNode.y) / 2 + 34}px`,
            }}
            type="button"
          >
            {RELATION_LABELS[relation.type]}
          </button>
        );
      })}
      {nodes.map((node) => {
        const isMatched = matchingNodeIds.has(node.id);
        const isSelected = node.id === selectedNodeId;

        return (
          <button
            className={`board-node board-node--${node.type} ${
              isSelected ? 'board-node--selected' : ''
            } ${isMatched ? '' : 'board-node--dimmed'}`}
            key={node.id}
            onClick={() => selectNode(node.id)}
            style={{ left: `${node.x}px`, top: `${node.y}px` }}
            type="button"
          >
            <span className="board-node-type">{NODE_TYPE_LABELS[node.type]}</span>
            <strong>{node.title}</strong>
            <span className="board-node-meta">{node.meta}</span>
            <span className="board-node-body">{node.body}</span>
            <span className="board-node-status">{node.status}</span>
          </button>
        );
      })}
    </>
  );
}

interface NodeInspectorProps {
  node: {
    body: string;
    id: string;
    meta: string;
    status: string;
    title: string;
    type: BoardNodeType;
    x: number;
    y: number;
  };
  nodeById: Map<string, {
    body: string;
    id: string;
    meta: string;
    status: string;
    title: string;
    type: BoardNodeType;
    x: number;
    y: number;
  }>;
  relations: Array<{
    fromNodeId: string;
    id: string;
    note: string;
    toNodeId: string;
    type: BoardRelationType;
  }>;
}

function NodeInspector({ node, nodeById, relations }: NodeInspectorProps) {
  const relatedRelations = relations.filter(
    (relation) => relation.fromNodeId === node.id || relation.toNodeId === node.id,
  );

  return (
    <div className="inspector-content">
      <p className="board-kicker">{NODE_TYPE_LABELS[node.type]}</p>
      <h2>{node.title}</h2>
      <dl className="inspector-fields">
        <div className="confidence-field">
          <dt>可信度</dt>
          <dd>
            <span className="confidence-track">
              <span className="confidence-fill" />
            </span>
          </dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{node.status}</dd>
        </div>
        <div>
          <dt>详情</dt>
          <dd>{node.body}</dd>
        </div>
      </dl>
      <section className="inspector-section">
        <h3>关联推理</h3>
        {relatedRelations.map((relation) => {
          const otherNodeId = relation.fromNodeId === node.id ? relation.toNodeId : relation.fromNodeId;
          const otherNode = nodeById.get(otherNodeId);

          return (
            <article className={`inspector-link inspector-link--${relation.type}`} key={relation.id}>
              <span>{RELATION_LABELS[relation.type]}</span>
              <strong>{otherNode?.title ?? '缺失节点'}</strong>
              <p>{relation.note}</p>
            </article>
          );
        })}
      </section>
      <button className="inspector-primary-action" type="button">
        继续关联线索
      </button>
    </div>
  );
}

interface RelationInspectorProps {
  nodeById: Map<string, {
    body: string;
    id: string;
    meta: string;
    status: string;
    title: string;
    type: BoardNodeType;
    x: number;
    y: number;
  }>;
  relation: {
    fromNodeId: string;
    id: string;
    note: string;
    toNodeId: string;
    type: BoardRelationType;
  };
}

function RelationInspector({ nodeById, relation }: RelationInspectorProps) {
  const fromNode = nodeById.get(relation.fromNodeId);
  const toNode = nodeById.get(relation.toNodeId);

  return (
    <div className="inspector-content">
      <p className="board-kicker">关系</p>
      <h2>{RELATION_LABELS[relation.type]}</h2>
      <dl className="inspector-fields">
        <div>
          <dt>来源</dt>
          <dd>{fromNode?.title ?? '缺失节点'}</dd>
        </div>
        <div>
          <dt>指向</dt>
          <dd>{toNode?.title ?? '缺失节点'}</dd>
        </div>
        <div>
          <dt>备注</dt>
          <dd>{relation.note}</dd>
        </div>
      </dl>
    </div>
  );
}

function normalizeQuery(value: string) {
  return value.trim().toLocaleLowerCase();
}
