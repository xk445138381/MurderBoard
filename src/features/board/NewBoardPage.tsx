import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { Game, ContentItem, Board, NodePosition, ContentRelation, UnlockRelation } from "../../domain/types";
import { computeUnlockRelations } from "../../domain/types";
import { useGameRepository, useContentItemRepository, useBoardRepository, useRelationRepository } from "../../shared/data/StorageContext";
import DynamicInspector from "./DynamicInspector";

function genId(): string { return crypto.randomUUID(); }

// 节点形状 → CSS border-radius 映射
const SHAPE_STYLE: Record<string, React.CSSProperties> = {
  circle: { borderRadius: "50%" },
  square: { borderRadius: 4 },
  diamond: { transform: "rotate(45deg)", borderRadius: 2 },
  hexagon: { borderRadius: 8 },
};

export default function NewBoardPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const gameRepo = useGameRepository();
  const itemRepo = useContentItemRepository();
  const boardRepo = useBoardRepository();
  const relRepo = useRelationRepository();

  const [game, setGame] = useState<Game | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [positions, setPositions] = useState<NodePosition[]>([]);
  const [relations, setRelations] = useState<ContentRelation[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;
    gameRepo.getById(gameId).then(g => {
      if (!g) { navigate("/"); return; }
      setGame(g);
      // Auto-create master board if none exist
      boardRepo.getByGame(gameId).then(bs => {
        if (bs.length === 0) {
          const master: Board = { id: genId(), gameId: gameId!, name: "总板面", kind: "master", indictmentId: null };
          boardRepo.create(master).then(b => { setBoards([b]); setActiveBoardId(b.id); });
        } else {
          setBoards(bs);
          setActiveBoardId(bs[0].id);
        }
        setLoading(false);
      });
    });
  }, [gameId]);

  // Load items when activeBoard changes
  useEffect(() => {
    if (!activeBoardId || !gameId) return;
    itemRepo.getByGame(gameId).then(setItems);
    boardRepo.getNodePositions(activeBoardId).then(setPositions);
    relRepo.getBySourceItem(gameId).then(s => {
      relRepo.getByTargetItem(gameId).then(t => {
        setRelations([...s, ...t.filter(r => !s.find(x => x.id === r.id))]);
      });
    });
  }, [activeBoardId, gameId]);

  const contentTypeMap = new Map(game?.contentTypes.map(ct => [ct.id, ct]) ?? []);

  // Items on this board (those with positions)
  const boardNodeIds = new Set(positions.map(p => p.contentItemId));
  const visibleItems = items.filter(item => boardNodeIds.has(item.id));

  const unlockRelations: UnlockRelation[] = computeUnlockRelations(items);

  // Drag
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    const pos = positions.find(p => p.contentItemId === itemId);
    if (!pos) return;
    setDragging(itemId);
    setDragOffset({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !activeBoardId) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    setPositions(prev => prev.map(p => p.contentItemId === dragging ? { ...p, x, y } : p));
  }, [dragging, dragOffset, activeBoardId]);

  const handleMouseUp = useCallback(() => {
    if (!dragging || !activeBoardId) return;
    const pos = positions.find(p => p.contentItemId === dragging);
    if (pos) boardRepo.saveNodePosition(pos);
    setDragging(null);
  }, [dragging, positions, activeBoardId]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Add item to board
  async function addItemToBoard(item: ContentItem) {
    if (!activeBoardId) return;
    const pos: NodePosition = { contentItemId: item.id, boardId: activeBoardId, x: 100 + Math.random() * 300, y: 100 + Math.random() * 300 };
    await boardRepo.saveNodePosition(pos);
    setPositions(prev => [...prev, pos]);
  }

  // Create new content item
  async function createNewItem(contentTypeId: string) {
    if (!gameId || !activeBoardId) return;
    const ct = contentTypeMap.get(contentTypeId);
    if (!ct) return;
    const item: ContentItem = {
      id: genId(), gameId, contentTypeId, title: `新建 ${ct.name}`,
      fieldValues: {}, unlockBlocks: [], acquisitionStatus: "acquired",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await itemRepo.create(item);
    setItems(prev => [...prev, item]);
    addItemToBoard(item);
  }

  if (loading || !game) return <div style={{ padding: 24, color: "#888" }}>加载中...</div>;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 48px)", overflow: "hidden" }}>
      {/* Board area */}
      <div style={{ flex: 1, position: "relative", background: "#0a0a1a", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderBottom: "1px solid #222", alignItems: "center", background: "#0d0d24" }}>
          <span style={{ fontWeight: 600, fontSize: 14, marginRight: 12 }}>{game.name}</span>
          {/* Board tabs */}
          {boards.map(b => (
            <button key={b.id} onClick={() => setActiveBoardId(b.id)}
              style={{ padding: "4px 12px", fontSize: 12, background: b.id === activeBoardId ? "#2563eb" : "#1a1a2e", color: "#eee", border: "none", borderRadius: 4, cursor: "pointer" }}>
              {b.name}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {/* Create item dropdown */}
          {game.contentTypes.length > 0 && (
            <select onChange={e => { if (e.target.value) createNewItem(e.target.value); e.target.value = ""; }}
              style={{ padding: "4px 8px", fontSize: 12, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 4 }}>
              <option value="">+ 新建</option>
              {game.contentTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
            </select>
          )}
          <button onClick={() => navigate("/games/new")} style={{ padding: "4px 12px", fontSize: 12, background: "#333", color: "#ccc", border: "none", borderRadius: 4, cursor: "pointer" }}>新建游戏</button>
        </div>

        {/* Canvas */}
        <div style={{ position: "relative", width: "100%", height: "calc(100% - 41px)", overflow: "auto" }}
          onClick={() => setSelectedItemId(null)}>
          {/* Unlock relation lines (dashed) */}
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            {unlockRelations.map(ur => {
              const fromPos = positions.find(p => p.contentItemId === ur.fromContentItemId);
              const toPos = positions.find(p => p.contentItemId === ur.toContentItemId);
              if (!fromPos || !toPos) return null;
              return (
                <line key={`unlock-${ur.unlockBlockId}`} x1={fromPos.x + 50} y1={fromPos.y + 30} x2={toPos.x + 50} y2={toPos.y + 30}
                  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6} />
              );
            })}
            {/* Relation lines (solid) */}
            {relations.filter(r => boardNodeIds.has(r.fromContentItemId) && boardNodeIds.has(r.toContentItemId)).map(r => {
              const fromPos = positions.find(p => p.contentItemId === r.fromContentItemId);
              const toPos = positions.find(p => p.contentItemId === r.toContentItemId);
              if (!fromPos || !toPos) return null;
              return (
                <line key={r.id} x1={fromPos.x + 50} y1={fromPos.y + 30} x2={toPos.x + 50} y2={toPos.y + 30}
                  stroke="#3b82f6" strokeWidth={2} opacity={0.7} />
              );
            })}
          </svg>

          {/* Nodes */}
          {visibleItems.map(item => {
            const ct = contentTypeMap.get(item.contentTypeId);
            const pos = positions.find(p => p.contentItemId === item.id);
            if (!pos || !ct) return null;

            const isSelected = selectedItemId === item.id;
            const isAcquired = item.acquisitionStatus === "acquired";
            const isUnlocked = item.acquisitionStatus === "unlocked";
            const style: React.CSSProperties = {
              position: "absolute",
              left: pos.x, top: pos.y,
              width: 100, minHeight: 60,
              background: isAcquired ? ct.visual.color : isUnlocked ? "#444" : "transparent",
              border: isSelected ? "2px solid white" : "1px solid #555",
              opacity: isAcquired ? 1 : 0.5,
              cursor: dragging === item.id ? "grabbing" : "grab",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 6, fontSize: 11, color: isAcquired ? "#fff" : "#888",
              userSelect: "none", wordBreak: "break-all",
              ...SHAPE_STYLE[ct.visual.shape],
            };

            return (
              <div key={item.id} style={style}
                onMouseDown={e => { handleMouseDown(e, item.id); setSelectedItemId(item.id); }}
                onClick={e => { e.stopPropagation(); setSelectedItemId(item.id); }}>
                {isUnlocked ? `${item.title} ?` : item.title}
              </div>
            );
          })}

          {/* Items not yet on board */}

        </div>
      </div>

      {/* Sidebar: items not on board + Inspector */}
      <div style={{ width: 260, borderLeft: "1px solid #222", background: "#0d0d24", overflow: "auto" }}>
        {selectedItemId ? (
          <DynamicInspector
            item={items.find(i => i.id === selectedItemId)!}
            contentType={contentTypeMap.get(items.find(i => i.id === selectedItemId)?.contentTypeId ?? "")}
            onUpdate={async (updated) => {
              await itemRepo.update(updated);
              setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
            }}
            onDelete={async (id) => {
              await itemRepo.delete(id);
              setItems(prev => prev.filter(i => i.id !== id));
              setSelectedItemId(null);
            }}
            onClose={() => setSelectedItemId(null)}
          />
        ) : (
          <div style={{ padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>未放置项目</div>
            {items.filter(i => !boardNodeIds.has(i.id)).map(item => (
              <div key={item.id} style={{ padding: "6px 8px", marginBottom: 4, background: "#1a1a2e", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                onClick={() => addItemToBoard(item)}>
                + {item.title || "未命名"}
              </div>
            ))}
            {items.filter(i => !boardNodeIds.has(i.id)).length === 0 && (
              <div style={{ fontSize: 12, color: "#666" }}>所有项目已放置在板面上</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

