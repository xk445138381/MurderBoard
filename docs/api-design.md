# MurderBoard API 设计

本文档描述 MurderBoard 首版可采用的 API 资源、请求语义和错误约定。具体协议可以是 REST、RPC 或本地服务接口，但业务语义应保持一致。

## 通用约定

### 标识

- 所有资源使用字符串 `id`。
- 客户端不应依赖 `id` 的生成规则。
- 复制、归档恢复和导入产生的新资源必须生成新 `id`。

### 时间

- 所有时间字段使用结构化 DateTime。
- API 输入和输出应使用统一格式。
- 系统操作时间与剧情事件时间分开表达。

### 删除

- 默认删除为软删除。
- 普通列表默认不返回软删除资源。
- 回收站接口只返回软删除资源。
- 永久删除只能作用于已软删除资源。

### 错误响应

错误应包含稳定错误码和可显示消息。

| 错误码 | 场景 |
| --- | --- |
| `VALIDATION_FAILED` | 请求字段缺失、格式错误或时间字段无效。 |
| `DUPLICATE_WORKSPACE_NAME` | 剧本名称重复。 |
| `DUPLICATE_CASE_NAME` | 同一剧本下案件名称重复。 |
| `NOT_FOUND` | 资源不存在或不可访问。 |
| `ALREADY_DELETED` | 资源已经在回收站。 |
| `NOT_DELETED` | 对未删除资源执行永久删除。 |
| `CONFLICT` | 恢复、复制或导入时发生状态冲突。 |

## Workspace 接口

### 创建剧本

`POST /workspaces`

请求：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 剧本名称，必须唯一。 |
| `description` | string | 否 | 剧本简介。 |

行为：

- 校验名称非空。
- 校验剧本名称唯一。
- 写入结构化 `createdAt` 和 `updatedAt`。

### 列出剧本

`GET /workspaces`

行为：

- 默认只返回未删除剧本。
- 可按更新时间倒序排序。

### 更新剧本

`PATCH /workspaces/{workspaceId}`

行为：

- 修改名称时重新校验唯一性。
- 更新 `updatedAt`。

### 删除剧本

`DELETE /workspaces/{workspaceId}`

行为：

- 标记 `deletedAt`。
- 相关案件应进入一致的软删除状态，或由业务层明确级联策略。

### 恢复剧本

`POST /workspaces/{workspaceId}/restore`

行为：

- 从回收站恢复剧本。
- 恢复前校验名称唯一性。

## Case 接口

### 创建案件

`POST /workspaces/{workspaceId}/cases`

请求：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 案件名称，同一剧本下唯一。 |
| `summary` | string | 否 | 案件摘要。 |

行为：

- 校验剧本存在且未删除。
- 校验案件名称在剧本下唯一。
- 默认状态为 `draft` 或 `active`。

### 列出案件

`GET /workspaces/{workspaceId}/cases`

查询参数：

| 字段 | 说明 |
| --- | --- |
| `status` | 可选，按案件状态过滤。 |
| `includeArchived` | 可选，是否包含归档案件。 |

行为：

- 默认排除软删除案件。
- 默认可排除归档案件，由产品入口决定。

### 更新案件

`PATCH /cases/{caseId}`

行为：

- 修改名称时校验同一剧本下唯一。
- 更新 `updatedAt`。

### 归档案件

`POST /cases/{caseId}/archive`

行为：

- 将状态改为 `archived`。
- 写入 `archivedAt`。

### 恢复归档案件

`POST /cases/{caseId}/restore-archive`

请求：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `targetWorkspaceId` | string | 否 | 目标剧本；未传时使用当前剧本。 |
| `name` | string | 否 | 新案件名称。 |

行为：

- 不修改原归档案件。
- 在目标剧本下创建新案件。
- 复制人物、线索、事件与关联关系。
- 生成新的案件和子实体 `id`。
- 校验新案件名称唯一性。

### 删除案件

`DELETE /cases/{caseId}`

行为：

- 标记 `deletedAt`。
- 记录删除前状态，用于恢复。
- 案件进入回收站。

### 恢复删除案件

`POST /cases/{caseId}/restore`

请求：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 否 | 名称冲突时可提供新名称。 |

行为：

- 校验案件处于已删除状态。
- 校验名称唯一性。
- 清空 `deletedAt`。
- 恢复到删除前状态。

### 永久删除案件

`DELETE /cases/{caseId}/purge`

行为：

- 只能对已软删除案件执行。
- 需要明确确认。
- 删除后不可恢复。

## Character 接口

- `POST /cases/{caseId}/characters`：创建人物。
- `GET /cases/{caseId}/characters`：列出人物。
- `PATCH /characters/{characterId}`：更新人物。
- `DELETE /characters/{characterId}`：软删除人物。
- `POST /characters/{characterId}/restore`：恢复人物。

人物删除后，事件中的关联关系应可安全展示为缺失或已删除人物。

## Clue 接口

- `POST /cases/{caseId}/clues`：创建线索。
- `GET /cases/{caseId}/clues`：列出线索。
- `PATCH /clues/{clueId}`：更新线索。
- `DELETE /clues/{clueId}`：软删除线索。
- `POST /clues/{clueId}/restore`：恢复线索。

`discoveredAt` 必须是结构化 DateTime 或为空。

## Event 接口

- `POST /cases/{caseId}/events`：创建事件。
- `GET /cases/{caseId}/events`：列出事件。
- `GET /cases/{caseId}/timeline`：按 `occurredAt` 获取时间线。
- `PATCH /events/{eventId}`：更新事件。
- `DELETE /events/{eventId}`：软删除事件。
- `POST /events/{eventId}/restore`：恢复事件。

事件请求可包含：

- `relatedCharacterIds`
- `relatedClueIds`

写入时必须校验关联资源属于同一案件且未被软删除。

## 回收站接口

### 列出回收站

`GET /trash`

查询参数：

| 字段 | 说明 |
| --- | --- |
| `workspaceId` | 可选，按剧本过滤。 |
| `type` | 可选，按资源类型过滤。 |

行为：

- 返回软删除资源。
- 按 `deletedAt` 倒序排列。

### 批量恢复

`POST /trash/restore`

行为：

- 对每个资源执行恢复校验。
- 任一资源发生名称冲突时，应返回冲突详情而不是静默覆盖。

### 清空回收站

`DELETE /trash`

行为：

- 永久删除回收站内资源。
- 应有明确确认机制。
