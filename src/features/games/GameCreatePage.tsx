import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ContentTypeTemplate, ContentType } from "../../domain/types";
import { fieldsMatch, instantiateContentType } from "../../domain/types";
import { useTemplateRepository, useGameRepository } from "../../shared/data/StorageContext";

function genId(): string { return crypto.randomUUID(); }

interface Selection {
  template: ContentTypeTemplate;
  selected: boolean;
  renamed: string | null;
}

export default function GameCreatePage() {
  const tplRepo = useTemplateRepository();
  const gameRepo = useGameRepository();
  const navigate = useNavigate();

  const [templates, setTemplates] = useState<Selection[]>([]);
  const [gameName, setGameName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ name: string; tplA: string; tplB: string }[]>([]);

  useEffect(() => {
    tplRepo.getAll().then(all => {
      setTemplates(all.map(t => ({ template: t, selected: true, renamed: null })));
      setLoading(false);
    });
  }, [tplRepo]);

  function toggle(tplId: string) {
    setTemplates(prev => prev.map(s => s.template.id === tplId ? { ...s, selected: !s.selected } : s));
    setConflicts([]);
  }

  function setRename(tplId: string, name: string | null) {
    setTemplates(prev => prev.map(s => s.template.id === tplId ? { ...s, renamed: name } : s));
  }

  function checkConflicts(): boolean {
    const selected = templates.filter(s => s.selected);
    const conflictsFound: { name: string; tplA: string; tplB: string }[] = [];
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const a = selected[i];
        const b = selected[j];
        const resolvedA = a.renamed || a.template.name;
        const resolvedB = b.renamed || b.template.name;
        if (resolvedA === resolvedB) {
          conflictsFound.push({ name: resolvedA, tplA: a.template.name, tplB: b.template.name });
        } else if (!fieldsMatch(a.template.fields, b.template.fields)) {
          // Only conflict if names match AND fields differ. If they match fully, they merge automatically.
          // Names are different here, so no conflict regardless of field match.
        }
      }
    }
    // Also check: same name + different fields -> conflict
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const a = selected[i];
        const b = selected[j];
        const resolvedA = a.renamed || a.template.name;
        const resolvedB = b.renamed || b.template.name;
        if (resolvedA === resolvedB && !fieldsMatch(a.template.fields, b.template.fields)) {
          if (!conflictsFound.find(c => c.name === resolvedA)) {
            conflictsFound.push({ name: resolvedA, tplA: a.template.name, tplB: b.template.name });
          }
        }
      }
    }
    setConflicts(conflictsFound);
    return conflictsFound.length > 0;
  }

  async function createGame() {
    if (!gameName.trim()) { setError("请输入游戏名称"); return; }
    if (templates.filter(s => s.selected).length === 0) { setError("请至少选择一个模板"); return; }
    if (checkConflicts()) { setError("存在模板冲突，请解决后再创建"); return; }
    setError(null);

    const selected = templates.filter(s => s.selected);
    const gameId = genId();
    const now = new Date().toISOString();
    const contentTypes: ContentType[] = [];
    const seen: Set<string> = new Set();

    for (const sel of selected) {
      const name = sel.renamed || sel.template.name;
      if (seen.has(name) && fieldsMatch(sel.template.fields, [])) {
        // Exact match = auto merge, skip
        continue;
      }
      // Check if this name already exists with matching fields (auto-merge)
      const existing = contentTypes.find(ct => ct.name === name && fieldsMatch(ct.fields, sel.template.fields));
      if (!existing) {
        contentTypes.push(instantiateContentType(sel.template, gameId, genId));
        seen.add(name);
      }
    }

    const game = { id: gameId, name: gameName.trim(), contentTypes, createdAt: now, updatedAt: now };
    await gameRepo.create(game);
    navigate(`/game/${gameId}`);
  }

  if (loading) return <div style={{ padding: 24, color: "#888" }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>新建游戏</h2>
      {error && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 14 }}>{error}</div>}

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>游戏名称</label>
        <input value={gameName} onChange={e => setGameName(e.target.value)} placeholder='例如 "黄尸案探案"'
          style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #444", borderRadius: 4, background: "#1a1a2e", color: "#eee" }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>选择模板（{templates.filter(s => s.selected).length} 个已选）</span>
        {templates.length === 0 && <div style={{ color: "#666", fontSize: 13, marginTop: 8 }}>暂无模板，请先创建模板。</div>}
      </div>

      {templates.map(sel => (
        <div key={sel.template.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
          marginBottom: 6, background: "#0f0f23", border: sel.selected ? "1px solid #2563eb" : "1px solid #333", borderRadius: 4
        }}>
          <input type="checkbox" checked={sel.selected} onChange={() => toggle(sel.template.id)} />
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600 }}>{sel.template.name}</span>
            <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>{sel.template.fields.length} 字段</span>
          </div>
          {sel.selected && (
            <input value={sel.renamed ?? ""} onChange={e => setRename(sel.template.id, e.target.value || null)}
              placeholder="重命名（可选）" style={{
                width: 160, padding: "3px 8px", fontSize: 12, background: "#1a1a2e", color: "#eee",
                border: "1px solid #444", borderRadius: 4
              }} />
          )}
        </div>
      ))}

      {conflicts.length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: "#451a1a", border: "1px solid #7f1d1d", borderRadius: 4, fontSize: 13 }}>
          <strong>模板冲突：</strong>
          {conflicts.map((c, i) => (
            <div key={i}>「{c.name}」在模板 "{c.tplA}" 和 "{c.tplB}" 中字段不同，请重命名其中一个。</div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button onClick={createGame} style={{ padding: "8px 20px", fontSize: 14, background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>创建游戏</button>
        <button onClick={() => navigate("/")} style={{ padding: "8px 20px", fontSize: 14, background: "#333", color: "#ccc", border: "none", borderRadius: 4, cursor: "pointer" }}>取消</button>
      </div>
    </div>
  );
}
