import React, { useState } from "react";
import type { ContentType, ContentItem, UnlockBlock, FieldType, AcquisitionStatus } from "../../domain/types";
import { FIELD_TYPE_LABELS } from "../../domain/types";

function genId(): string { return crypto.randomUUID(); }

interface Props {
  item: ContentItem;
  contentType: ContentType | undefined;
  onUpdate: (item: ContentItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function DynamicInspector({ item, contentType, onUpdate, onDelete, onClose }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({ ...item.fieldValues });
  const [unlockBlocks, setUnlockBlocks] = useState<UnlockBlock[]>([...item.unlockBlocks]);

  function updateField(name: string, value: unknown) {
    setValues(prev => ({ ...prev, [name]: value }));
  }

  function updateBlock(index: number, patch: Partial<UnlockBlock>) {
    setUnlockBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...patch } : b));
  }

  function addBlock() {
    setUnlockBlocks(prev => [...prev, { id: genId(), targetName: "", requiredPerson: null, requiredLocation: null, status: "locked" as AcquisitionStatus }]);
  }

  function removeBlock(index: number) {
    setUnlockBlocks(prev => prev.filter((_, i) => i !== index));
  }

  function save() {
    const now = new Date().toISOString();
    onUpdate({ ...item, fieldValues: values, unlockBlocks, updatedAt: now });
  }

  if (!contentType) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#888" }}>未知内容类型</div>
      </div>
    );
  }

  function renderField(name: string, type: FieldType, required: boolean, enumOptions?: string[]) {
    const value = values[name] ?? "";
    const label = `${name}${required ? " *" : ""}`;
    const inputStyle: React.CSSProperties = {
      width: "100%", padding: "4px 8px", fontSize: 12, background: "#1a1a2e", color: "#eee",
      border: "1px solid #444", borderRadius: 4, boxSizing: "border-box",
    };

    switch (type) {
      case "single-line-text":
        return <input value={String(value)} onChange={e => updateField(name, e.target.value)} style={inputStyle} />;
      case "multi-line-text":
        return <textarea value={String(value)} onChange={e => updateField(name, e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />;
      case "datetime":
      case "date-range":
        return <input type="datetime-local" value={String(value)} onChange={e => updateField(name, e.target.value)} style={inputStyle} />;
      case "number":
        return <input type="number" value={Number(value) || 0} onChange={e => updateField(name, Number(e.target.value))} style={inputStyle} />;
      case "enum":
        return (
          <select value={String(value)} onChange={e => updateField(name, e.target.value)} style={inputStyle}>
            <option value="">--</option>
            {(enumOptions ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        );
      case "boolean":
        return <input type="checkbox" checked={Boolean(value)} onChange={e => updateField(name, e.target.checked)} />;
      case "reference":
        return <input value={String(value)} onChange={e => updateField(name, e.target.value)} placeholder="引用 ID" style={inputStyle} />;
      case "unlock-block":
        return null; // Rendered separately below
      default:
        return <input value={String(value)} onChange={e => updateField(name, e.target.value)} style={inputStyle} />;
    }
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</div>
          <div style={{ fontSize: 11, color: "#888" }}>{contentType.name}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16 }}>✕</button>
      </div>

      {/* Title field */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 2 }}>标题 *</label>
        <input value={item.title} onChange={e => { item.title = e.target.value; }} style={{
          width: "100%", padding: "4px 8px", fontSize: 12, background: "#1a1a2e", color: "#eee",
          border: "1px solid #444", borderRadius: 4, boxSizing: "border-box",
        }} />
      </div>

      {/* Content type fields (excluding unlock-block) */}
      {contentType.fields.filter(f => f.type !== "unlock-block").map(f => (
        <div key={f.name} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 2 }}>{f.name}{f.required ? " *" : ""}</label>
          {renderField(f.name, f.type, f.required, f.enumOptions)}
        </div>
      ))}

      {/* Unlock blocks */}
      {contentType.unlockEnabled && (
        <div style={{ marginTop: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600 }}>解锁块</span>
            <button onClick={addBlock} style={{ fontSize: 11, padding: "2px 8px", background: "#2563eb", color: "white", border: "none", borderRadius: 3, cursor: "pointer" }}>+</button>
          </div>
          {unlockBlocks.map((block, i) => (
            <div key={block.id} style={{ padding: 6, marginBottom: 4, background: "#0f0f23", border: "1px solid #333", borderRadius: 4 }}>
              <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                <input value={block.targetName} onChange={e => updateBlock(i, { targetName: e.target.value })} placeholder="目标名称"
                  style={{ flex: 1, padding: "3px 6px", fontSize: 11, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 3 }} />
                <select value={block.status} onChange={e => updateBlock(i, { status: e.target.value as AcquisitionStatus })}
                  style={{ padding: "3px 6px", fontSize: 11, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 3 }}>
                  <option value="locked">未解锁</option>
                  <option value="unlocked">已解锁</option>
                  <option value="acquired">已获取</option>
                </select>
                <button onClick={() => removeBlock(i)} style={{ padding: "2px 6px", fontSize: 11, background: "#7f1d1d", color: "white", border: "none", borderRadius: 3, cursor: "pointer" }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <input value={block.requiredPerson ?? ""} onChange={e => updateBlock(i, { requiredPerson: e.target.value || null })} placeholder="所需人员"
                  style={{ flex: 1, padding: "3px 6px", fontSize: 11, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 3 }} />
                <input value={block.requiredLocation ?? ""} onChange={e => updateBlock(i, { requiredLocation: e.target.value || null })} placeholder="所需前往"
                  style={{ flex: 1, padding: "3px 6px", fontSize: 11, background: "#1a1a2e", color: "#eee", border: "1px solid #444", borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
        <button onClick={save} style={{ flex: 1, padding: "6px 0", fontSize: 12, background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>保存</button>
        <button onClick={() => onDelete(item.id)} style={{ padding: "6px 12px", fontSize: 12, background: "#7f1d1d", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>删除</button>
      </div>
    </div>
  );
}
