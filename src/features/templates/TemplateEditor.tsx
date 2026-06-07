import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { FieldDefinition, FieldType, NodeShape, BoardNodeVisual, ContentTypeTemplate } from "../../domain/types";
import { FIELD_TYPES, FIELD_TYPE_LABELS, NODE_SHAPES } from "../../domain/types";
import { useTemplateRepository } from "../../shared/data/StorageContext";

function genId(): string { return crypto.randomUUID(); }

export default function TemplateEditor() {
  const repo = useTemplateRepository();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [visual, setVisual] = useState<BoardNodeVisual>({ color: "#3b82f6", shape: "square" });
  const [unlockEnabled, setUnlockEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addField() {
    setFields(prev => [...prev, { name: "", type: "single-line-text" as FieldType, required: false }]);
  }
  function updateField(i: number, p: Partial<FieldDefinition>) {
    setFields(prev => prev.map((f, j) => j === i ? { ...f, ...p } : f));
  }
  function removeField(i: number) { setFields(prev => prev.filter((_, j) => j !== i)); }
  function moveField(i: number, d: -1 | 1) {
    const t = i + d;
    if (t < 0 || t >= fields.length) return;
    setFields(prev => { const n = [...prev]; [n[i], n[t]] = [n[t], n[i]]; return n; });
  }

  async function save() {
    if (!name.trim()) { setError("请输入模板名称"); return; }
    for (const f of fields) {
      if (!f.name.trim()) { setError("所有字段必须填写名称"); return; }
      if (f.type === "enum" && (!f.enumOptions || f.enumOptions.length === 0)) {
        setError(`枚举字段 "${f.name}" 需要至少一个选项`); return;
      }
    }
    setError(null); setSaving(true);
    try {
      await repo.create({
        id: genId(), name: name.trim(),
        fields: fields.map(f => ({ ...f, name: f.name.trim(), enumOptions: f.type === "enum" ? (f.enumOptions ?? ["选项1"]) : undefined })),
        visual: { ...visual }, unlockEnabled, createdAt: new Date().toISOString(),
      });
      navigate("/templates");
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  }

  const inp = (v: string, set: (s: string) => void, ph: string) => (
    <input value={v} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ width: "100%", padding: "6px 10px", fontSize: 14, border: "1px solid #444", borderRadius: 4, background: "#1a1a2e", color: "#eee" }} />
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: 24 }}>
      <h2 style={{ fontSize: 20, marginBottom: 20 }}>新建模板</h2>
      {error && <div style={{ color: "#ef4444", marginBottom: 12, fontSize: 14 }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 4, fontSize: 13, fontWeight: 600 }}>模板名称</label>
        {inp(name, setName, "例如 明朝探案")}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={unlockEnabled} onChange={e => setUnlockEnabled(e.target.checked)} />
          此类型可包含解锁块
        </label>
      </div>

      <fieldset style={{ marginBottom: 20, padding: 12, border: "1px solid #333", borderRadius: 4, background: "#0f0f23" }}>
        <legend style={{ fontSize: 13, fontWeight: 600 }}>板面视觉</legend>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>颜色: <input type="color" value={visual.color}
            onChange={e => setVisual(v => ({ ...v, color: e.target.value }))}
            style={{ width: 36, height: 28, border: "none", cursor: "pointer" }} /></label>
          <label style={{ fontSize: 13 }}>形状: <select value={visual.shape}
            onChange={e => setVisual(v => ({ ...v, shape: e.target.value as NodeShape }))}
            style={{ padding: "4px 8px", background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 4 }}>
            {NODE_SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
          </select></label>
        </div>
      </fieldset>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>字段定义</span>
          <button onClick={addField} style={{ fontSize: 13, padding: "4px 12px", background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>+ 添加字段</button>
        </div>
        {fields.length === 0 && <div style={{ color: "#666", fontSize: 13, padding: 12 }}>尚未添加字段。</div>}
        {fields.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6, padding: 6, background: "#0f0f23", border: "1px solid #333", borderRadius: 4, flexWrap: "wrap" }}>
            <button onClick={() => moveField(i, -1)} disabled={i === 0} style={{ fontSize: 11, padding: "0 4px", background: "#333", color: "#ccc", border: "none", borderRadius: 2, cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.4 : 1 }}>▲</button>
            <button onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} style={{ fontSize: 11, padding: "0 4px", background: "#333", color: "#ccc", border: "none", borderRadius: 2, cursor: i === fields.length - 1 ? "default" : "pointer", opacity: i === fields.length - 1 ? 0.4 : 1 }}>▼</button>
            <input value={f.name} onChange={e => updateField(i, { name: e.target.value })} placeholder="字段名" style={{ flex: "1 1 100px", minWidth: 80, padding: "4px 8px", fontSize: 13, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 4 }} />
            <select value={f.type} onChange={e => updateField(i, { type: e.target.value as FieldType })} style={{ padding: "4px 6px", fontSize: 12, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 4 }}>
              {FIELD_TYPES.map(ft => <option key={ft} value={ft}>{FIELD_TYPE_LABELS[ft]}</option>)}
            </select>
            <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 3 }}><input type="checkbox" checked={f.required} onChange={e => updateField(i, { required: e.target.checked })} />必填</label>
            {f.type === "enum" && <input value={f.enumOptions?.join(",") ?? ""} onChange={e => updateField(i, { enumOptions: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} placeholder="选项1,选项2" style={{ flex: "1 1 120px", minWidth: 100, padding: "4px 8px", fontSize: 12, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 4 }} />}
            <button onClick={() => removeField(i)} title="删除" style={{ fontSize: 13, padding: "2px 8px", background: "#7f1d1d", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={save} disabled={saving} style={{ padding: "8px 20px", fontSize: 14, background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "保存中..." : "保存模板"}</button>
        <button onClick={() => navigate("/templates")} style={{ padding: "8px 20px", fontSize: 14, background: "#333", color: "#ccc", border: "none", borderRadius: 4, cursor: "pointer" }}>取消</button>
      </div>
    </div>
  );
}
