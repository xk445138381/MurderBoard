import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useBoardData } from './useBoardData';
import { useWorkspaceCaseSelection } from '../../shared/data/useWorkspaceCaseSelection';
import { useMurderBoardRepository } from '../../shared/data/MurderBoardDataProvider';
import type { BoardNodeType, BoardRelationType, HypothesisStatus } from '../../domain/types';
import type { BoardViewNode, BoardViewRelation } from './useBoardData';

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

const HYPOTHESIS_STATUS_OPTIONS: { value: HypothesisStatus; label: string }[] = [
  { value: 'unverified', label: '待验证' },
  { value: 'plausible', label: '较可信' },
  { value: 'refuted', label: '被反驳' },
];

export function BoardPage() {
  const repository = useMurderBoardRepository();
  const { isLoadingScope, refreshScope, selectedCaseId } = useWorkspaceCaseSelection();
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

  // --- Error notification ---
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showError(msg: string) {
    setErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setErrorMessage(null), 5000);
  }

  function dismissError() {
    setErrorMessage(null);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }

  // --- Inspector edit state ---
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editMeta, setEditMeta] = useState('');
  const [editStatus, setEditStatus] = useState<HypothesisStatus>('unverified');
  const [editConfidence, setEditConfidence] = useState(50);
  const [editRelType, setEditRelType] = useState<BoardRelationType>('related');
  const [editRelNote, setEditRelNote] = useState('');

  // --- Delete confirm state ---
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // --- Relation creation state ---
  const [showRelationForm, setShowRelationForm] = useState(false);
  const [relSourceNodeId, setRelSourceNodeId] = useState<string | null>(null);
  const [relTargetNodeId, setRelTargetNodeId] = useState('');
  const [relType, setRelType] = useState<BoardRelationType>('supports');
  const [relNote, setRelNote] = useState('');

  // --- Drag state ---
  const [dragState, setDragState] = useState<{
    nodeId: string;
    nodeType: BoardNodeType;
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDragging: boolean;
  } | null>(null);
  const dragRef = useRef<{
    nodeId: string;
    nodeType: BoardNodeType;
    baseX: number;
    baseY: number;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const isDraggedRef = useRef(false);

  // --- Node lookup ---
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  // --- Matching / filtering ---
  const queryLower = query.trim().toLocaleLowerCase();
  const matchingNodeIds = useMemo(() => {
    if (!queryLower) {
      return new Set(nodes.map((node) => node.id));
    }
    return new Set(
      nodes
        .filter((node) =>
          [node.title, node.meta, node.body, node.status, NODE_TYPE_LABELS[node.type]]
            .some((value) => value.toLocaleLowerCase().includes(queryLower)),
        )
        .map((node) => node.id),
    );
  }, [nodes, queryLower]);

  const visibleRelations = useMemo(
    () => relations.filter(
      (relation) => relationFilter === 'all' || relation.type === relationFilter,
    ),
    [relations, relationFilter],
  );
  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const selectedRelation =
    selectedRelationId ? relations.find((relation) => relation.id === selectedRelationId) ?? null : null;

  // --- Search auto-select ---
  useEffect(() => {
    if (queryLower && nodes.length > 0) {
      const firstMatch = nodes.find((n) => matchingNodeIds.has(n.id));
      if (firstMatch && firstMatch.id !== selectedNodeId) {
        setSelectedNodeId(firstMatch.id);
        setSelectedRelationId(null);
        setIsEditing(false);
        setShowRelationForm(false);
      }
    }
  }, [queryLower, nodes, matchingNodeIds, selectedNodeId]);

  // --- Selection ---
  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setSelectedRelationId(null);
    setIsEditing(false);
    setShowRelationForm(false);
    setDeleteConfirm(null);
  }

  function selectRelation(relationId: string) {
    setSelectedRelationId(relationId);
    setSelectedNodeId(null);
    setIsEditing(false);
    setShowRelationForm(false);
    setDeleteConfirm(null);
  }

  // --- Quick add ---
  async function handleQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title || !selectedCaseId) return;

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
      showError('创建失败，请检查网络后重试');
    }
  }

  // --- Inspector editing ---
  function openEdit() {
    if (selectedRelation) {
      setEditRelType(selectedRelation.type);
      setEditRelNote(selectedRelation.note);
      setIsEditing(true);
      return;
    }
    if (!selectedNode) return;
    setEditTitle(selectedNode.title);
    setEditBody(selectedNode.body);

    switch (selectedNode.type) {
      case 'person':
        setEditMeta(selectedNode.personRole ?? '');
        setIsEditing(true);
        break;
      case 'clue':
        setEditMeta(selectedNode.clueSource ?? '');
        setIsEditing(true);
        break;
      case 'event':
        setEditMeta(selectedNode.eventOccurredAt ?? '');
        setIsEditing(true);
        break;
      case 'hypothesis':
        setEditStatus(selectedNode.hypothesisStatus ?? 'unverified');
        setEditConfidence(selectedNode.hypothesisConfidence ?? 50);
        setIsEditing(true);
        break;
    }
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  async function saveEdit() {
    if (!selectedNodeId) {
      if (selectedRelationId) {
        await saveRelationEdit();
      }
      return;
    }

    try {
      switch (selectedNode?.type) {
        case 'person':
          await repository.updateCharacter(selectedNodeId, { name: editTitle, role: editMeta, notes: editBody });
          break;
        case 'clue':
          await repository.updateClue(selectedNodeId, { title: editTitle, source: editMeta, content: editBody });
          break;
        case 'event':
          await repository.updateEvent(selectedNodeId, { title: editTitle, occurredAt: editMeta || new Date().toISOString(), description: editBody });
          break;
        case 'hypothesis':
          await repository.updateHypothesis(selectedNodeId, { title: editTitle, body: editBody, status: editStatus, confidence: editConfidence });
          break;
      }
      setIsEditing(false);
      void refresh();
    } catch {
      showError('保存失败，请稍后重试');
    }
  }

  async function saveRelationEdit() {
    if (!selectedRelationId) return;
    try {
      await repository.updateBoardRelation(selectedRelationId, {
        type: editRelType,
        note: editRelNote,
      });
      setIsEditing(false);
      void refresh();
    } catch {
      showError('保存失败，请稍后重试');
    }
  }

  // --- Delete ---
  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.startsWith('node:')) {
        const nodeId = deleteConfirm.slice(5);
        const node = nodeById.get(nodeId);
        if (!node) return;
        switch (node.type) {
          case 'person':
            await repository.softDeleteCharacter(nodeId);
            break;
          case 'clue':
            await repository.softDeleteClue(nodeId);
            break;
          case 'event':
            await repository.softDeleteEvent(nodeId);
            break;
          case 'hypothesis':
            await repository.softDeleteHypothesis(nodeId);
            break;
        }
        setSelectedNodeId(null);
      } else if (deleteConfirm.startsWith('relation:')) {
        const relationId = deleteConfirm.slice(9);
        await repository.softDeleteBoardRelation(relationId);
        setSelectedRelationId(null);
      }
      setDeleteConfirm(null);
      void refresh();
    } catch {
      showError('删除失败，请稍后重试');
      setDeleteConfirm(null);
    }
  }

  // --- Relation creation ---
  function openRelationForm(sourceNodeId: string) {
    setRelSourceNodeId(sourceNodeId);
    setRelTargetNodeId('');
    setRelType('supports');
    setRelNote('');
    setShowRelationForm(true);
    setIsEditing(false);
  }

  function cancelRelationForm() {
    setShowRelationForm(false);
  }

  async function submitRelation() {
    if (!selectedCaseId || !relSourceNodeId || !relTargetNodeId) return;

    const sourceNode = nodeById.get(relSourceNodeId);
    const targetNode = nodeById.get(relTargetNodeId);
    if (!sourceNode || !targetNode) return;

    try {
      await repository.createBoardRelation(selectedCaseId, {
        fromNodeType: sourceNode.type,
        fromNodeId: sourceNode.id,
        toNodeType: targetNode.type,
        toNodeId: targetNode.id,
        type: relType,
        note: relNote || undefined,
      });
      setShowRelationForm(false);
      void refresh();
    } catch {
      showError('关系创建失败，这两个节点可能不在同一案件中');
    }
  }

  // --- Drag ---
  const handleNodePointerDown = useCallback((
    nodeId: string, nodeType: BoardNodeType, x: number, y: number, e: React.PointerEvent,
  ) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDraggedRef.current = false;
    const target = e.currentTarget as HTMLElement;
    if (typeof target.setPointerCapture === 'function') target.setPointerCapture(e.pointerId);
    dragRef.current = { nodeId, nodeType, baseX: x, baseY: y, startX: e.clientX, startY: e.clientY, isDragging: false };
    setDragState({ nodeId, nodeType, baseX: x, baseY: y, startX: e.clientX, startY: e.clientY, currentX: x, currentY: y, isDragging: false });
  }, []);

  const handleNodePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const isDragging = dragRef.current.isDragging || Math.abs(dx) > 5 || Math.abs(dy) > 5;
    dragRef.current.isDragging = isDragging;
    if (isDragging) isDraggedRef.current = true;
    setDragState({
      nodeId: dragRef.current.nodeId, nodeType: dragRef.current.nodeType,
      baseX: dragRef.current.baseX, baseY: dragRef.current.baseY,
      startX: dragRef.current.startX, startY: dragRef.current.startY,
      currentX: dragRef.current.baseX + dx, currentY: dragRef.current.baseY + dy, isDragging,
    });
  }, []);

  const handleNodePointerUp = useCallback(async (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const target = e.currentTarget as HTMLElement;
    if (typeof target.releasePointerCapture === 'function') target.releasePointerCapture(e.pointerId);
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const isDrag = Math.abs(dx) > 5 || Math.abs(dy) > 5;
    dragRef.current = null;
    if (isDrag && selectedCaseId) {
      const finalX = Math.round(drag.baseX + dx);
      const finalY = Math.round(drag.baseY + dy);
      setDragState(null);
      try {
        await repository.saveBoardNodePosition(selectedCaseId, { nodeType: drag.nodeType, nodeId: drag.nodeId, x: finalX, y: finalY });
        void refresh();
      } catch { showError('位置保存失败'); }
    } else {
      setDragState(null);
    }
  }, [selectedCaseId, repository, refresh]);

  // --- Create default case ---
  async function handleCreateDefaultCase() {
    try {
      const workspaces = await repository.listWorkspaces();
      let workspaceId = workspaces[0]?.id;
      if (!workspaceId) {
        const workspace = await repository.createWorkspace({ name: '默认工作区' });
        workspaceId = workspace.id;
      }
      const caseRecord = await repository.createCase(workspaceId, { name: '我的案件', status: 'active' });
      await refreshScope(workspaceId, caseRecord.id);
    } catch { showError('创建案件失败，请稍后重试'); }
  }

  // --- Relation form: available targets ---
  const relationTargetOptions = useMemo(
    () => nodes.filter((n) => n.id !== relSourceNodeId),
    [nodes, relSourceNodeId],
  );

  return (
    <section aria-labelledby="board-title" className="board-page">
      {errorMessage ? (
        <div className="board-notification board-notification--error">
          <span>{errorMessage}</span>
          <button className="board-notification-close" onClick={dismissError} type="button" aria-label="关闭">×</button>
        </div>
      ) : null}

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
          {queryLower && matchingNodeIds.size > 0 ? (
            <span className="board-search-count">{matchingNodeIds.size} 个匹配</span>
          ) : null}
        </label>
        <div className="relation-filter" aria-label="关系筛选">
          <button className={relationFilter === 'all' ? 'active' : ''} onClick={() => setRelationFilter('all')} type="button">全部</button>
          {RELATION_TYPES.map((relationType) => (
            <button className={relationFilter === relationType ? 'active' : ''} data-relation={relationType} key={relationType} onClick={() => setRelationFilter(relationType)} type="button">
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
            <p className="quick-capture-copy">先写短条目，等桌面节奏慢下来再补充细节。</p>
          </div>
          <form className="quick-capture-form" onSubmit={handleQuickAdd}>
            <label htmlFor="quick-node-type">类型</label>
            <select disabled={!selectedCaseId} id="quick-node-type" onChange={(event) => setQuickType(event.target.value as BoardNodeType)} value={quickType}>
              {NODE_TYPES.map((nodeType) => (<option key={nodeType} value={nodeType}>{NODE_TYPE_LABELS[nodeType]}</option>))}
            </select>
            <label htmlFor="quick-node-title">标题</label>
            <input disabled={!selectedCaseId} id="quick-node-title" onChange={(event) => setQuickTitle(event.target.value)} placeholder={selectedCaseId ? '例如：缺失的钥匙' : '请先创建或选择一个案件'} value={quickTitle} />
            <button disabled={!selectedCaseId} type="submit">添加到案件板</button>
          </form>
          <div className="capture-shortcuts" aria-label="节点类型指南">
            {NODE_TYPES.map((nodeType) => (
              <button className={quickType === nodeType ? 'active' : ''} key={nodeType} onClick={() => setQuickType(nodeType)} type="button">
                <span className={`node-dot node-dot--${nodeType}`} />{NODE_TYPE_LABELS[nodeType]}
              </button>
            ))}
          </div>
          <div className="quick-sets" aria-label="快速视图">
            <p className="board-kicker">快速视图</p>
            <button type="button"><strong>矛盾点</strong><span>只看反驳关系和未确认猜想</span></button>
            <button type="button"><strong>嫌疑图</strong><span>查看和未解猜想有关的人物</span></button>
          </div>
          <div className="link-legend" aria-label="关系颜色图例">
            <p className="board-kicker">关系颜色</p>
            {RELATION_TYPES.map((relationType) => (<span key={relationType} data-relation={relationType}>{RELATION_LABELS[relationType]}</span>))}
          </div>
        </aside>

        <div className="case-board" aria-label="可视化案件板">
          {renderBoardContent(isLoadingScope, boardStatus, selectedCaseId, boardError, nodes, nodeById, visibleRelations, selectedNodeId, matchingNodeIds, selectedRelationId, dragState, handleNodePointerDown, handleNodePointerMove, handleNodePointerUp, selectRelation, selectNode, handleCreateDefaultCase)}
        </div>

        <aside className="board-inspector" aria-label="检查器">
          {deleteConfirm ? (
            <div className="inspector-content">
              <p className="board-kicker">确认删除</p>
              <h2>确定要删除吗？</h2>
              <p>删除后可以在回收站恢复，画布上不再显示。</p>
              <div className="inspector-edit-actions">
                <button className="inspector-save-btn" onClick={confirmDelete} type="button">确认删除</button>
                <button className="inspector-cancel-btn" onClick={() => setDeleteConfirm(null)} type="button">取消</button>
              </div>
            </div>
          ) : showRelationForm ? (
            <RelationCreateForm selectedCaseId={selectedCaseId} sourceNodeId={relSourceNodeId} targetNodeId={relTargetNodeId} relationType={relType} relationNote={relNote} targetOptions={relationTargetOptions} sourceNode={relSourceNodeId ? nodeById.get(relSourceNodeId) ?? null : null} onSubmit={submitRelation} onCancel={cancelRelationForm} onTargetChange={setRelTargetNodeId} onTypeChange={setRelType} onNoteChange={setRelNote} />
          ) : selectedRelation ? (
            <RelationInspector relation={selectedRelation} nodeById={nodeById} isEditing={isEditing} editRelType={editRelType} editRelNote={editRelNote} onEdit={openEdit} onCancelEdit={cancelEdit} onSave={saveRelationEdit} onRelTypeChange={setEditRelType} onRelNoteChange={setEditRelNote} onDelete={() => setDeleteConfirm(`relation:${selectedRelation.id}`)} />
          ) : selectedNode ? (
            <NodeInspector node={selectedNode} nodeById={nodeById} relations={relations} isEditing={isEditing} editTitle={editTitle} editBody={editBody} editMeta={editMeta} editStatus={editStatus} editConfidence={editConfidence} onEdit={openEdit} onCancelEdit={cancelEdit} onSave={saveEdit} onTitleChange={setEditTitle} onBodyChange={setEditBody} onMetaChange={setEditMeta} onStatusChange={setEditStatus} onConfidenceChange={setEditConfidence} onRelationCreate={openRelationForm} onDelete={() => setDeleteConfirm(`node:${selectedNode.id}`)} />
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

// --- Board Canvas ---

function renderBoardContent(
  isLoadingScope: boolean, boardStatus: string, selectedCaseId: string | null, boardError: string | null,
  nodes: BoardViewNode[], nodeById: Map<string, BoardViewNode>, visibleRelations: BoardViewRelation[],
  selectedNodeId: string | null, matchingNodeIds: Set<string>, selectedRelationId: string | null,
  dragState: any, onPointerDown: any, onPointerMove: any, onPointerUp: any,
  onSelectRelation: (relationId: string) => void, onSelectNode: (nodeId: string) => void,
  onCreateCase: () => void,
) {
  if (isLoadingScope || boardStatus === 'loading') {
    return (<div className="board-empty-state"><p className="board-kicker">案件板</p><h2>正在整理案件板</h2></div>);
  }
  if (!selectedCaseId) {
    return (
      <div className="board-empty-state">
        <p className="board-kicker">案件板</p>
        <h2>先创建或选择一个案件</h2>
        <p>案件板会记录你在本局游戏中已经知道的人物、线索、事件和猜想。</p>
        <button className="board-empty-cta" onClick={onCreateCase} type="button">创建默认案件</button>
      </div>
    );
  }
  if (boardStatus === 'error') {
    return (<div className="board-empty-state"><p className="board-kicker">案件板</p><h2>加载案件板时出错</h2>{boardError ? <p>{boardError}</p> : null}</div>);
  }

  return (
    <>
      <div className="board-canvas-heading">
        <div><h2>渡鸦宅邸案件板</h2><p>整理玩家已知、怀疑和可以推翻的证据关系。</p></div>
        <div className="board-stats" aria-label="案件板统计">
          <span>{nodes.length} 个节点</span><span>{visibleRelations.length} 条关系</span>
        </div>
      </div>
      <svg className="relationship-layer" viewBox="0 0 980 640" aria-hidden="true">
        {visibleRelations.map((relation) => {
          const fromNode = nodeById.get(relation.fromNodeId);
          const toNode = nodeById.get(relation.toNodeId);
          if (!fromNode || !toNode) return null;
          return (<line className={`relation-line relation-line--${relation.type} ${relation.id === selectedRelationId ? 'relation-line--selected' : ''}`} key={relation.id} x1={fromNode.x + 108} x2={toNode.x + 108} y1={fromNode.y + 54} y2={toNode.y + 54} />);
        })}
      </svg>
      {visibleRelations.map((relation) => {
        const fromNode = nodeById.get(relation.fromNodeId);
        const toNode = nodeById.get(relation.toNodeId);
        if (!fromNode || !toNode) return null;
        return (<button className={`relation-label relation-label--${relation.type}`} key={relation.id} aria-label={`选择${RELATION_LABELS[relation.type]}关系`} onClick={(e) => { e.stopPropagation(); onSelectRelation(relation.id); }} style={{ left: `${(fromNode.x + toNode.x) / 2 + 60}px`, top: `${(fromNode.y + toNode.y) / 2 + 34}px` }} type="button">{RELATION_LABELS[relation.type]}</button>);
      })}
      {nodes.map((node) => {
        const isMatched = matchingNodeIds.has(node.id);
        const isSelected = node.id === selectedNodeId;
        const dragNode = dragState?.nodeId === node.id ? dragState : null;
        return (
          <button className={`board-node board-node--${node.type} ${isSelected ? 'board-node--selected' : ''} ${isMatched ? '' : 'board-node--dimmed'} ${dragNode?.isDragging ? 'board-node--dragging' : ''}`} key={node.id} onClick={() => onSelectNode(node.id)} onPointerDown={(e) => onPointerDown(node.id, node.type, node.x, node.y, e)} onPointerMove={onPointerMove} onPointerUp={onPointerUp} style={{ left: `${dragNode?.currentX ?? node.x}px`, top: `${dragNode?.currentY ?? node.y}px`, touchAction: 'none', cursor: dragNode?.isDragging ? 'grabbing' : 'grab' }} type="button">
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

// --- Node Inspector ---

interface NodeInspectorProps {
  node: BoardViewNode;
  nodeById: Map<string, BoardViewNode>;
  relations: BoardViewRelation[];
  isEditing: boolean;
  editTitle: string;
  editBody: string;
  editMeta: string;
  editStatus: HypothesisStatus;
  editConfidence: number;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onMetaChange: (v: string) => void;
  onStatusChange: (v: HypothesisStatus) => void;
  onConfidenceChange: (v: number) => void;
  onRelationCreate?: (sourceNodeId: string) => void;
  onDelete?: () => void;
}

function NodeInspector({
  node, nodeById, relations, isEditing, editTitle, editBody, editMeta, editStatus, editConfidence,
  onEdit, onCancelEdit, onSave, onTitleChange, onBodyChange, onMetaChange, onStatusChange, onConfidenceChange,
  onRelationCreate, onDelete,
}: NodeInspectorProps) {
  const relatedRelations = relations.filter(
    (relation) => relation.fromNodeId === node.id || relation.toNodeId === node.id,
  );

  if (isEditing) {
    return (
      <div className="inspector-content">
        <p className="board-kicker">编辑 {NODE_TYPE_LABELS[node.type]}</p>
        <div className="inspector-edit">
          <label>标题<input value={editTitle} onChange={(e) => onTitleChange(e.target.value)} /></label>
          {node.type === 'person' ? (
            <label>角色<input value={editMeta} onChange={(e) => onMetaChange(e.target.value)} placeholder="目击者、嫌疑人等" /></label>
          ) : node.type === 'clue' ? (
            <label>来源<input value={editMeta} onChange={(e) => onMetaChange(e.target.value)} placeholder="书房、卧室等" /></label>
          ) : node.type === 'event' ? (
            <label>发生时间<input value={editMeta} onChange={(e) => onMetaChange(e.target.value)} placeholder="2026-01-01T12:00:00.000Z" /></label>
          ) : null}
          {node.type === 'hypothesis' ? (
            <>
              <label>状态<select value={editStatus} onChange={(e) => onStatusChange(e.target.value as HypothesisStatus)}>
                {HYPOTHESIS_STATUS_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
              </select></label>
              <label>可信度: {editConfidence}%<input type="range" min={0} max={100} value={editConfidence} onChange={(e) => onConfidenceChange(Number(e.target.value))} /></label>
            </>
          ) : null}
          <label>详情<textarea value={editBody} onChange={(e) => onBodyChange(e.target.value)} rows={3} /></label>
          <div className="inspector-edit-actions">
            <button className="inspector-save-btn" onClick={onSave} type="button">保存</button>
            <button className="inspector-cancel-btn" onClick={onCancelEdit} type="button">取消</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-content">
      <p className="board-kicker">{NODE_TYPE_LABELS[node.type]}</p>
      <h2>{node.title}</h2>
      <dl className="inspector-fields">
        {node.type === 'hypothesis' ? (
          <div className="confidence-field">
            <dt>可信度</dt>
            <dd><span className="confidence-track"><span className="confidence-fill" style={{ width: `${node.hypothesisConfidence ?? 50}%` }} /></span></dd>
          </div>
        ) : null}
        <div><dt>状态</dt><dd>{node.meta}</dd></div>
        {node.type === 'person' && node.personRole ? <div><dt>角色</dt><dd>{node.personRole}</dd></div> : null}
        <div><dt>详情</dt><dd>{node.body}</dd></div>
      </dl>
      <section className="inspector-section">
        <h3>关联推理</h3>
        {relatedRelations.length === 0 ? <p className="inspector-empty-hint">暂无关联系</p> : relatedRelations.map((relation) => {
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
      <div className="inspector-actions">
        <button className="inspector-primary-action" onClick={onEdit} type="button">编辑{NODE_TYPE_LABELS[node.type]}</button>
        {onRelationCreate ? <button className="inspector-secondary-action" onClick={() => onRelationCreate(node.id)} type="button">继续关联线索</button> : null}
        {onDelete ? <button className="inspector-delete-btn" onClick={onDelete} type="button">删除节点</button> : null}
      </div>
    </div>
  );
}

// --- Relation Inspector ---

interface RelationInspectorProps {
  nodeById: Map<string, BoardViewNode>;
  relation: BoardViewRelation;
  isEditing: boolean;
  editRelType: BoardRelationType;
  editRelNote: string;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onRelTypeChange: (v: BoardRelationType) => void;
  onRelNoteChange: (v: string) => void;
  onDelete?: () => void;
}

function RelationInspector({
  nodeById, relation, isEditing, editRelType, editRelNote,
  onEdit, onCancelEdit, onSave, onRelTypeChange, onRelNoteChange, onDelete,
}: RelationInspectorProps) {
  const fromNode = nodeById.get(relation.fromNodeId);
  const toNode = nodeById.get(relation.toNodeId);

  if (isEditing) {
    return (
      <div className="inspector-content">
        <p className="board-kicker">编辑关系</p>
        <div className="inspector-edit">
          <label>关系类型<select value={editRelType} onChange={(e) => onRelTypeChange(e.target.value as BoardRelationType)}>
            {RELATION_TYPES.map((rt) => (<option key={rt} value={rt}>{RELATION_LABELS[rt]}</option>))}
          </select></label>
          <label>备注<textarea value={editRelNote} onChange={(e) => onRelNoteChange(e.target.value)} rows={3} /></label>
          <div className="inspector-edit-actions">
            <button className="inspector-save-btn" onClick={onSave} type="button">保存</button>
            <button className="inspector-cancel-btn" onClick={onCancelEdit} type="button">取消</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inspector-content">
      <p className="board-kicker">关系</p>
      <h2>{RELATION_LABELS[relation.type]}</h2>
      <dl className="inspector-fields">
        <div><dt>来源</dt><dd>{fromNode?.title ?? '缺失节点'}</dd></div>
        <div><dt>指向</dt><dd>{toNode?.title ?? '缺失节点'}</dd></div>
        <div><dt>备注</dt><dd>{relation.note}</dd></div>
      </dl>
      <div className="inspector-actions">
        <button className="inspector-primary-action" onClick={onEdit} type="button">编辑关系</button>
        {onDelete ? <button className="inspector-delete-btn" onClick={onDelete} type="button">删除关系</button> : null}
      </div>
    </div>
  );
}

// --- Relation Create Form ---

interface RelationCreateFormProps {
  selectedCaseId: string | null;
  sourceNodeId: string | null;
  targetNodeId: string;
  relationType: BoardRelationType;
  relationNote: string;
  targetOptions: BoardViewNode[];
  sourceNode: BoardViewNode | null;
  onSubmit: () => void;
  onCancel: () => void;
  onTargetChange: (v: string) => void;
  onTypeChange: (v: BoardRelationType) => void;
  onNoteChange: (v: string) => void;
}

function RelationCreateForm({ selectedCaseId, sourceNodeId, targetNodeId, relationType, relationNote, targetOptions, sourceNode, onSubmit, onCancel, onTargetChange, onTypeChange, onNoteChange }: RelationCreateFormProps) {
  if (!selectedCaseId) return (<div className="inspector-empty"><p className="board-kicker">建立关系</p><h2>请先选择案件</h2></div>);
  if (!sourceNodeId) return (<div className="inspector-empty"><p className="board-kicker">建立关系</p><h2>请先选择一个节点</h2></div>);

  return (
    <div className="inspector-content">
      <p className="board-kicker">建立关系</p>
      <h2>关联节点</h2>
      <dl className="inspector-fields"><div><dt>来源</dt><dd>{sourceNode?.title ?? '未知'}</dd></div></dl>
      <div className="inspector-edit">
        <label>目标节点<select value={targetNodeId} onChange={(e) => onTargetChange(e.target.value)}><option value="">选择目标节点</option>{targetOptions.map((n) => (<option key={n.id} value={n.id}>[{NODE_TYPE_LABELS[n.type]}] {n.title}</option>))}</select></label>
        <label>关系类型<select value={relationType} onChange={(e) => onTypeChange(e.target.value as BoardRelationType)}>{RELATION_TYPES.map((rt) => (<option key={rt} value={rt}>{RELATION_LABELS[rt]}</option>))}</select></label>
        <label>备注<textarea value={relationNote} onChange={(e) => onNoteChange(e.target.value)} rows={3} placeholder="描述这条关系的依据" /></label>
        <div className="inspector-edit-actions">
          <button className="inspector-save-btn" disabled={!targetNodeId} onClick={onSubmit} type="button">确认建立</button>
          <button className="inspector-cancel-btn" onClick={onCancel} type="button">取消</button>
        </div>
      </div>
    </div>
  );
}
