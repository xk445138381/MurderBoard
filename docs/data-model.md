# MurderBoard 数据模型

本文档细化 MurderBoard 的核心实体、字段约束、状态流转与持久化规则。它补充 [技术规格说明](technical-spec.md)，用于指导后续数据库、接口与业务逻辑实现。

## 设计原则

- 以剧本为顶层容器，案件、人物、线索与事件都归属于明确的上级范围。
- 所有系统时间字段使用结构化日期时间值，避免自由文本时间导致排序和比较困难。
- 删除默认采用软删除，并通过撤销或回收站恢复。
- 归档恢复不覆盖原案件，而是在当前剧本下创建新案件。
- 名称唯一性在写入入口统一校验。

## 通用字段

多数实体应包含以下通用字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 全局唯一标识。 |
| `createdAt` | DateTime | 创建时间。 |
| `updatedAt` | DateTime | 最后更新时间。 |
| `deletedAt` | DateTime? | 软删除时间，未删除时为空。 |

结构化 `DateTime` 应能被稳定序列化、排序和比较。剧情内时间线时间应与系统操作时间分开建模。

## 实体

### Workspace

剧本是最高层级的组织单元。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | string | 必填，唯一。 |
| `name` | string | 必填，唯一。 |
| `description` | string? | 可为空。 |
| `createdAt` | DateTime | 必填。 |
| `updatedAt` | DateTime | 必填。 |
| `deletedAt` | DateTime? | 软删除时写入。 |

索引与约束：

- `UNIQUE(name)`：剧本名称不允许重复。
- 常用查询应排除 `deletedAt` 不为空的数据，除非访问回收站。

### Case

案件隶属于剧本。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | string | 必填，唯一。 |
| `workspaceId` | string | 必填，指向 `Workspace.id`。 |
| `name` | string | 必填，同一剧本内唯一。 |
| `status` | CaseStatus | 必填。 |
| `summary` | string? | 可为空。 |
| `createdAt` | DateTime | 必填。 |
| `updatedAt` | DateTime | 必填。 |
| `archivedAt` | DateTime? | 归档时写入。 |
| `deletedAt` | DateTime? | 软删除时写入。 |

索引与约束：

- `UNIQUE(workspaceId, name)`：同一剧本下案件名称不允许重复。
- `INDEX(workspaceId, status)`：支持按剧本和状态列出案件。
- `INDEX(deletedAt)`：支持回收站查询。

### Character

人物记录涉案角色信息。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | string | 必填，唯一。 |
| `caseId` | string | 必填，指向 `Case.id`。 |
| `name` | string | 必填。 |
| `role` | string? | 可为空。 |
| `notes` | string? | 可为空。 |
| `createdAt` | DateTime | 必填。 |
| `updatedAt` | DateTime | 必填。 |
| `deletedAt` | DateTime? | 软删除时写入。 |

### Clue

线索记录证据、证词、物品或地点发现。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | string | 必填，唯一。 |
| `caseId` | string | 必填，指向 `Case.id`。 |
| `title` | string | 必填。 |
| `content` | string? | 可为空。 |
| `source` | string? | 可为空。 |
| `discoveredAt` | DateTime? | 发现时间，可为空。 |
| `createdAt` | DateTime | 必填。 |
| `updatedAt` | DateTime | 必填。 |
| `deletedAt` | DateTime? | 软删除时写入。 |

### Event

事件用于构建剧情时间线和因果链。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | string | 必填，唯一。 |
| `caseId` | string | 必填，指向 `Case.id`。 |
| `title` | string | 必填。 |
| `description` | string? | 可为空。 |
| `occurredAt` | DateTime | 必填，表示剧情事件发生时间。 |
| `createdAt` | DateTime | 必填。 |
| `updatedAt` | DateTime | 必填。 |
| `deletedAt` | DateTime? | 软删除时写入。 |

关联关系：

- `EventCharacter(eventId, characterId)`：事件与人物多对多关联。
- `EventClue(eventId, clueId)`：事件与线索多对多关联。

## 枚举

### CaseStatus

| 值 | 说明 |
| --- | --- |
| `draft` | 草稿。 |
| `active` | 进行中。 |
| `archived` | 已归档。 |
| `deleted` | 已删除，位于回收站。 |

`deleted` 状态应与 `deletedAt` 同步维护；归档案件应有 `archivedAt`。

## 状态流转

### 案件状态

```text
draft -> active -> archived
draft -> deleted
active -> deleted
archived -> deleted
deleted -> draft | active | archived
```

恢复删除案件时，应回到删除前状态。若无法确定删除前状态，应要求业务层明确目标状态。

### 归档恢复

归档恢复不是简单地把原案件从 `archived` 改回 `active`。恢复操作应：

1. 选择当前剧本作为目标剧本。
2. 复制原案件及其人物、线索、事件和关联关系。
3. 生成新的 `Case.id` 以及子实体标识。
4. 校验目标剧本下案件名称唯一性。
5. 创建新的案件记录。

## 写入校验

所有创建、重命名、复制、导入、恢复入口都应执行以下校验：

- 剧本名称非空且唯一。
- 案件名称非空且在目标剧本下唯一。
- 时间字段是结构化日期时间。
- 外键引用必须存在且未被软删除，除非操作目标是回收站或恢复流程。
- 永久删除只能作用于已软删除的数据。

## 查询约定

- 默认列表不返回软删除数据。
- 回收站查询只返回 `deletedAt` 不为空的数据。
- 归档列表按 `archivedAt` 或 `updatedAt` 排序。
- 时间线查询按 `occurredAt` 排序。
- 案件详情应按需加载人物、线索、事件与关联关系，避免不必要的大对象读取。
