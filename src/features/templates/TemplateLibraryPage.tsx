import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ContentTypeTemplate } from "../../domain/types";
import { useTemplateRepository } from "../../shared/data/StorageContext";

export default function TemplateLibraryPage() {
  const repo = useTemplateRepository();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<ContentTypeTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    repo.getAll().then(setTemplates).finally(() => setLoading(false));
  }, [repo]);

  if (loading) return <div style={{ padding: 24, color: "#888" }}>加载中...</div>;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>模板库</h2>
        <button onClick={() => navigate("/templates/new")}
          style={{ padding: "6px 16px", fontSize: 14, background: "#2563eb", color: "white", border: "none", borderRadius: 4, cursor: "pointer" }}>
          + 新建模板
        </button>
      </div>

      {templates.length === 0 ? (
        <div style={{ color: "#666", fontSize: 14, padding: 24, textAlign: "center" }}>
          暂无模板。新建一个模板来定义内容类型。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {templates.map(t => (
            <div key={t.id} style={{ padding: 12, background: "#0f0f23", border: "1px solid #333", borderRadius: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{t.name}</span>
                  <span style={{ marginLeft: 10, fontSize: 12, color: "#888" }}>
                    {t.fields.length} 个字段 &middot; {t.unlockEnabled ? "可含解锁块" : "无解锁块"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 3, background: t.visual.color, border: "1px solid #555" }} />
                  <span style={{ fontSize: 12, color: "#888" }}>{t.visual.shape}</span>
                </div>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#888" }}>
                {t.fields.map(f => (
                  <span key={f.name} style={{ marginRight: 8, background: "#1a1a2e", padding: "1px 6px", borderRadius: 3, border: "1px solid #333" }}>
                    {f.name} <span style={{ color: "#666" }}>{f.type}</span>
                  </span>
                ))}
                {t.fields.length === 0 && <span>无字段</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <Link to="/" style={{ fontSize: 13, color: "#60a5fa" }}>← 返回首页</Link>
      </div>
    </div>
  );
}
