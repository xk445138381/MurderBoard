import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CASE_STATUSES,
  type Case,
  type RestorableCaseStatus,
  type Workspace,
} from '../../domain/types';
import { useMurderBoardRepository } from '../../shared/data/MurderBoardDataProvider';
import { EmptyState, ErrorState, LoadingState } from '../../shared/state';
import type {
  CaseImportInput,
  CaseImportPreview,
  CopyCaseInput,
  MoveCaseInput,
} from '../../storage/repositories';
import { confirmDestructiveAction } from '../../shared/confirm';
import { StorageDomainError } from '../../storage/storage-error';

const EDITABLE_CASE_STATUSES = CASE_STATUSES.filter(
  (status): status is RestorableCaseStatus => status !== 'deleted',
);

export function CasesPage() {
  const repository = useMurderBoardRepository();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [caseQuery, setCaseQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RestorableCaseStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );
  const filteredWorkspaces = useMemo(() => {
    const query = normalizeSearchTerm(workspaceQuery);
    if (!query) {
      return workspaces;
    }

    return workspaces.filter((workspace) =>
      [workspace.name, workspace.description].some((value) => normalizeSearchTerm(value).includes(query)),
    );
  }, [workspaceQuery, workspaces]);
  const filteredCases = useMemo(() => {
    const query = normalizeSearchTerm(caseQuery);
    return cases
      .filter((caseRecord) => statusFilter === 'all' || caseRecord.status === statusFilter)
      .filter((caseRecord) => {
        if (!query) {
          return true;
        }

        return [caseRecord.name, caseRecord.summary, caseRecord.status].some((value) =>
          normalizeSearchTerm(value).includes(query),
        );
      });
  }, [caseQuery, cases, statusFilter]);

  const refresh = useCallback(
    async (preferredWorkspaceId?: string | null) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextWorkspaces = await repository.listWorkspaces();
        const nextSelectedWorkspaceId =
          preferredWorkspaceId && nextWorkspaces.some((workspace) => workspace.id === preferredWorkspaceId)
            ? preferredWorkspaceId
            : (nextWorkspaces[0]?.id ?? null);
        const nextCases = nextSelectedWorkspaceId
          ? await repository.listCases(nextSelectedWorkspaceId)
          : [];

        setWorkspaces(nextWorkspaces);
        setSelectedWorkspaceId(nextSelectedWorkspaceId);
        setCases(nextCases);
      } catch (error) {
        setErrorMessage(formatActionError(error));
      } finally {
        setIsLoading(false);
      }
    },
    [repository],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAction(action: () => Promise<string | null | undefined>) {
    setErrorMessage(null);

    try {
      const workspaceId = await action();
      await refresh(workspaceId ?? selectedWorkspaceId);
    } catch (error) {
      setErrorMessage(formatActionError(error));
    }
  }

  return (
    <section aria-labelledby="cases-title" className="stack">
      <div className="page-heading">
        <div>
          <h1 id="cases-title">案件管理</h1>
        </div>
        <p>
          创建、搜索、复制、移动、导入、归档和回收本地优先的谜案。
        </p>
      </div>

      {errorMessage ? <ErrorState title="操作失败" message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="加载中..." /> : null}

      <CreateWorkspaceForm
        onCreate={(input) =>
          runAction(async () => {
            const workspace = await repository.createWorkspace(input);
            return workspace.id;
          })
        }
      />

      {workspaces.length === 0 && !isLoading ? (
        <EmptyState
          title="暂无工作区"
          message="创建工作区以分组相关谜案。"
        />
      ) : null}

      {workspaces.length > 0 ? (
        <div className="case-management-grid">
          <aside className="panel form-grid" aria-label="工作区列表">
            <h2>工作区</h2>
            <label htmlFor="workspace-search">搜索工作区</label>
            <input
              id="workspace-search"
              onChange={(event) => setWorkspaceQuery(event.target.value)}
              placeholder="按名称或描述筛选"
              value={workspaceQuery}
            />
            <div className="item-list">
              {filteredWorkspaces.map((workspace) => (
                <button
                  className={
                    workspace.id === selectedWorkspaceId
                      ? 'list-button list-button--active'
                      : 'list-button'
                  }
                  key={workspace.id}
                  onClick={() => {
                    setSelectedWorkspaceId(workspace.id);
                    void refresh(workspace.id);
                  }}
                  type="button"
                >
                  <span>{workspace.name}</span>
                  <small>{workspace.description || '无描述'}</small>
                </button>
              ))}
            </div>
            {filteredWorkspaces.length === 0 ? (
              <p className="muted">无匹配工作区</p>
            ) : null}
          </aside>

          <div className="stack">
            {selectedWorkspace ? (
              <>
                <WorkspaceEditor
                  workspace={selectedWorkspace}
                  onDelete={() =>
                    runAction(async () => {
                      if (!confirmDestructiveAction(`将工作区"${selectedWorkspace.name}"移至回收站？`)) {
                        return selectedWorkspace.id;
                      }
                      await repository.softDeleteWorkspace(selectedWorkspace.id);
                      return null;
                    })
                  }
                  onSave={(input) =>
                    runAction(async () => {
                      const workspace = await repository.updateWorkspace(selectedWorkspace.id, input);
                      return workspace.id;
                    })
                  }
                />
                <CreateCaseForm
                  onCreate={(input) =>
                    runAction(async () => {
                      await repository.createCase(selectedWorkspace.id, input);
                      return selectedWorkspace.id;
                    })
                  }
                />
                <CaseFilters
                  caseQuery={caseQuery}
                  onCaseQueryChange={setCaseQuery}
                  onStatusFilterChange={setStatusFilter}
                  statusFilter={statusFilter}
                />
                <CaseList
                  cases={filteredCases}
                  emptyMessage={
                    cases.length === 0
                      ? '在所选工作区中创建一个案件。'
                      : '无案件匹配当前搜索或状态筛选。'
                  }
                  emptyTitle={cases.length === 0 ? '暂无案件' : '无匹配案件'}
                  onCopy={(caseId, input) =>
                    runAction(async () => {
                      const copiedCase = await repository.copyCase(caseId, input);
                      return copiedCase.workspaceId;
                    })
                  }
                  onMove={(caseId, input) =>
                    runAction(async () => {
                      const movedCase = await repository.moveCase(caseId, input);
                      return movedCase.workspaceId;
                    })
                  }
                  onArchive={(caseId) =>
                    runAction(async () => {
                      await repository.archiveCase(caseId);
                      return selectedWorkspace.id;
                    })
                  }
                  onDelete={(caseId) =>
                    runAction(async () => {
                      const caseRecord = cases.find((candidate) => candidate.id === caseId);
                      if (
                        caseRecord &&
                        !confirmDestructiveAction(`将案件"${caseRecord.name}"移至回收站？`)
                      ) {
                        return selectedWorkspace.id;
                      }
                      await repository.softDeleteCase(caseId);
                      return selectedWorkspace.id;
                    })
                  }
                  onSave={(caseId, input) =>
                    runAction(async () => {
                      await repository.updateCase(caseId, input);
                      return selectedWorkspace.id;
                    })
                  }
                  workspaces={workspaces}
                />
                <ImportCaseForm
                  onImport={(input) =>
                    runAction(async () => {
                      await repository.importCaseDraft(selectedWorkspace.id, input);
                      return selectedWorkspace.id;
                    })
                  }
                  onPreview={(input) => repository.previewCaseImport(selectedWorkspace.id, input)}
                />
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface CreateWorkspaceFormProps {
  onCreate: (input: { name: string; description?: string }) => void;
}

function CreateWorkspaceForm({ onCreate }: CreateWorkspaceFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ name, description });
    setName('');
    setDescription('');
  }

  return (
    <form aria-label="创建工作区" className="panel form-grid" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="workspace-name">工作区名称</label>
        <input
          id="workspace-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：红楼梦谜案"
          value={name}
        />
      </div>
      <div>
        <label htmlFor="workspace-description">描述</label>
        <input
          id="workspace-description"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="可选的故事或战役备注"
          value={description}
        />
      </div>
      <button type="submit">创建工作区</button>
    </form>
  );
}

interface WorkspaceEditorProps {
  onDelete: () => void;
  onSave: (input: { name?: string; description?: string }) => void;
  workspace: Workspace;
}

function WorkspaceEditor({ onDelete, onSave, workspace }: WorkspaceEditorProps) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description);

  useEffect(() => {
    setName(workspace.name);
    setDescription(workspace.description);
  }, [workspace]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name, description });
  }

  return (
    <form aria-label="编辑工作区" className="panel form-grid" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">当前工作区</p>
          <h2>{workspace.name}</h2>
        </div>
        <span className="badge">更新于 {formatDateTime(workspace.updatedAt)}</span>
      </div>
      <div>
        <label htmlFor="selected-workspace-name">工作区名称</label>
        <input
          id="selected-workspace-name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>
      <div>
        <label htmlFor="selected-workspace-description">描述</label>
        <textarea
          id="selected-workspace-description"
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          value={description}
        />
      </div>
      <div className="button-row">
        <button type="submit">保存工作区</button>
        <button onClick={onDelete} type="button">
          删除工作区
        </button>
      </div>
    </form>
  );
}

interface CreateCaseFormProps {
  onCreate: (input: { name: string; summary?: string; status?: RestorableCaseStatus }) => void;
}

interface CaseFiltersProps {
  caseQuery: string;
  onCaseQueryChange: (value: string) => void;
  onStatusFilterChange: (value: RestorableCaseStatus | 'all') => void;
  statusFilter: RestorableCaseStatus | 'all';
}

function CaseFilters({
  caseQuery,
  onCaseQueryChange,
  onStatusFilterChange,
  statusFilter,
}: CaseFiltersProps) {
  return (
    <section aria-label="筛选案件" className="panel form-grid">
      <h2>搜索和筛选案件</h2>
      <div>
        <label htmlFor="case-search">搜索案件</label>
        <input
          id="case-search"
          onChange={(event) => onCaseQueryChange(event.target.value)}
          placeholder="按名称、摘要或状态筛选"
          value={caseQuery}
        />
      </div>
      <div>
        <label htmlFor="case-status-filter">状态筛选</label>
        <select
          id="case-status-filter"
          onChange={(event) =>
            onStatusFilterChange(event.target.value as RestorableCaseStatus | 'all')
          }
          value={statusFilter}
        >
          <option value="all">全部状态</option>
          {EDITABLE_CASE_STATUSES.map((caseStatus) => (
            <option key={caseStatus} value={caseStatus}>
              {caseStatus}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

function CreateCaseForm({ onCreate }: CreateCaseFormProps) {
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<RestorableCaseStatus>('draft');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ name, summary, status });
    setName('');
    setSummary('');
    setStatus('draft');
  }

  return (
    <form aria-label="创建案件" className="panel form-grid" onSubmit={handleSubmit}>
      <h2>创建案件</h2>
      <div>
        <label htmlFor="case-name">案件名称</label>
        <input
          id="case-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="例如：第一夜"
          value={name}
        />
      </div>
      <div>
        <label htmlFor="case-summary">摘要</label>
        <textarea
          id="case-summary"
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          value={summary}
        />
      </div>
      <div>
        <label htmlFor="case-status">状态</label>
        <select
          id="case-status"
          onChange={(event) => setStatus(event.target.value as RestorableCaseStatus)}
          value={status}
        >
          {EDITABLE_CASE_STATUSES.map((caseStatus) => (
            <option key={caseStatus} value={caseStatus}>
              {caseStatus}
            </option>
          ))}
        </select>
      </div>
      <button type="submit">创建案件</button>
    </form>
  );
}

interface CaseListProps {
  cases: Case[];
  emptyMessage: string;
  emptyTitle: string;
  onArchive: (caseId: string) => void;
  onCopy: (caseId: string, input: CopyCaseInput) => void;
  onDelete: (caseId: string) => void;
  onMove: (caseId: string, input: MoveCaseInput) => void;
  onSave: (caseId: string, input: { name?: string; summary?: string; status?: RestorableCaseStatus }) => void;
  workspaces: Workspace[];
}

function CaseList({
  cases,
  emptyMessage,
  emptyTitle,
  onArchive,
  onCopy,
  onDelete,
  onMove,
  onSave,
  workspaces,
}: CaseListProps) {
  if (cases.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="stack" aria-label="案件列表">
      <h2>工作区中的案件</h2>
      {cases.map((caseRecord) => (
        <CaseEditor
          caseRecord={caseRecord}
          key={caseRecord.id}
          onArchive={onArchive}
          onCopy={onCopy}
          onDelete={onDelete}
          onMove={onMove}
          onSave={onSave}
          workspaces={workspaces}
        />
      ))}
    </div>
  );
}

interface CaseEditorProps {
  caseRecord: Case;
  onArchive: (caseId: string) => void;
  onCopy: (caseId: string, input: CopyCaseInput) => void;
  onDelete: (caseId: string) => void;
  onMove: (caseId: string, input: MoveCaseInput) => void;
  onSave: (caseId: string, input: { name?: string; summary?: string; status?: RestorableCaseStatus }) => void;
  workspaces: Workspace[];
}

function CaseEditor({
  caseRecord,
  onArchive,
  onCopy,
  onDelete,
  onMove,
  onSave,
  workspaces,
}: CaseEditorProps) {
  const [name, setName] = useState(caseRecord.name);
  const [summary, setSummary] = useState(caseRecord.summary);
  const [status, setStatus] = useState<RestorableCaseStatus>(
    caseRecord.status === 'deleted' ? 'draft' : caseRecord.status,
  );
  const [copyName, setCopyName] = useState(`${caseRecord.name} 的副本`);
  const [copyTargetWorkspaceId, setCopyTargetWorkspaceId] = useState(caseRecord.workspaceId);
  const [moveName, setMoveName] = useState(caseRecord.name);
  const [moveTargetWorkspaceId, setMoveTargetWorkspaceId] = useState(caseRecord.workspaceId);

  useEffect(() => {
    setName(caseRecord.name);
    setSummary(caseRecord.summary);
    setStatus(caseRecord.status === 'deleted' ? 'draft' : caseRecord.status);
    setCopyName(`${caseRecord.name} 的副本`);
    setCopyTargetWorkspaceId(caseRecord.workspaceId);
    setMoveName(caseRecord.name);
    setMoveTargetWorkspaceId(caseRecord.workspaceId);
  }, [caseRecord]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(caseRecord.id, { name, summary, status });
  }

  return (
    <article className="panel">
      <form aria-label={`编辑案件 ${caseRecord.name}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">案件详情</p>
            <h3>{caseRecord.name}</h3>
          </div>
          <span className="badge">{caseRecord.status}</span>
        </div>
        <div>
          <label htmlFor={`case-name-${caseRecord.id}`}>案件名称</label>
          <input
            id={`case-name-${caseRecord.id}`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div>
          <label htmlFor={`case-summary-${caseRecord.id}`}>摘要</label>
          <textarea
            id={`case-summary-${caseRecord.id}`}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            value={summary}
          />
        </div>
        <div>
          <label htmlFor={`case-status-${caseRecord.id}`}>状态</label>
          <select
            id={`case-status-${caseRecord.id}`}
            onChange={(event) => setStatus(event.target.value as RestorableCaseStatus)}
            value={status}
          >
            {EDITABLE_CASE_STATUSES.map((caseStatus) => (
              <option key={caseStatus} value={caseStatus}>
                {caseStatus}
              </option>
            ))}
          </select>
        </div>
        <div className="button-row">
          <button type="submit">保存案件</button>
          <button
            disabled={caseRecord.status === 'archived'}
            onClick={() => onArchive(caseRecord.id)}
            type="button"
          >
            归档案件
          </button>
          <button onClick={() => onDelete(caseRecord.id)} type="button">
            删除案件
          </button>
        </div>
      </form>
      <section aria-label={`复制或移动案件 ${caseRecord.name}`} className="form-grid nested-panel">
        <h4>复制或移动</h4>
        <div>
          <label htmlFor={`case-copy-name-${caseRecord.id}`}>复制名称</label>
          <input
            id={`case-copy-name-${caseRecord.id}`}
            onChange={(event) => setCopyName(event.target.value)}
            value={copyName}
          />
        </div>
        <div>
          <label htmlFor={`case-copy-workspace-${caseRecord.id}`}>目标工作区</label>
          <select
            id={`case-copy-workspace-${caseRecord.id}`}
            onChange={(event) => setCopyTargetWorkspaceId(event.target.value)}
            value={copyTargetWorkspaceId}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() =>
            onCopy(caseRecord.id, {
              name: copyName,
              targetWorkspaceId: copyTargetWorkspaceId,
            })
          }
          type="button"
        >
          复制案件
        </button>
        <div>
          <label htmlFor={`case-move-name-${caseRecord.id}`}>移动名称</label>
          <input
            id={`case-move-name-${caseRecord.id}`}
            onChange={(event) => setMoveName(event.target.value)}
            value={moveName}
          />
        </div>
        <div>
          <label htmlFor={`case-move-workspace-${caseRecord.id}`}>目标工作区</label>
          <select
            id={`case-move-workspace-${caseRecord.id}`}
            onChange={(event) => setMoveTargetWorkspaceId(event.target.value)}
            value={moveTargetWorkspaceId}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() =>
            onMove(caseRecord.id, {
              name: moveName,
              targetWorkspaceId: moveTargetWorkspaceId,
            })
          }
          type="button"
        >
          移动案件
        </button>
      </section>
    </article>
  );
}

interface ImportCaseFormProps {
  onImport: (input: CaseImportInput) => Promise<void>;
  onPreview: (input: CaseImportInput) => Promise<CaseImportPreview>;
}

const CASE_IMPORT_EXAMPLE = JSON.stringify(
  {
    name: 'Imported Case',
    summary: 'Optional case summary',
    status: 'active',
    characters: [{ name: 'Detective Lin', role: 'investigator', notes: '' }],
    clues: [
      {
        title: 'Broken watch',
        content: 'Stopped at midnight',
        source: 'Study',
        discoveredAt: null,
      },
    ],
    events: [
      {
        title: 'Midnight argument',
        description: 'Witness heard raised voices',
        occurredAt: '2024-01-01T00:00:00Z',
        relatedCharacterNames: ['Detective Lin'],
        relatedClueTitles: ['Broken watch'],
      },
    ],
  },
  null,
  2,
);

function ImportCaseForm({ onImport, onPreview }: ImportCaseFormProps) {
  const [jsonText, setJsonText] = useState(CASE_IMPORT_EXAMPLE);
  const [preview, setPreview] = useState<CaseImportPreview | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function parseImportInput() {
    try {
      setLocalError(null);
      return JSON.parse(jsonText) as CaseImportInput;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON.';
      setLocalError(`无效的导入 JSON：${message}`);
      return null;
    }
  }

  async function handlePreview() {
    const input = parseImportInput();
    if (!input) {
      return;
    }

    try {
      setPreview(await onPreview(input));
    } catch (error) {
      setPreview(null);
      setLocalError(formatActionError(error));
    }
  }

  async function handleImport() {
    const input = parseImportInput();
    if (!input) {
      return;
    }

    await onImport(input);
    setPreview(null);
  }

  return (
    <section aria-label="导入案件 JSON" className="panel form-grid">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">导入</p>
          <h2>导入案件 JSON</h2>
        </div>
      </div>
      <p className="muted">
        粘贴案件快照，预览名称冲突，然后导入到所选工作区。
      </p>
      <div>
        <label htmlFor="case-import-json">案件 JSON</label>
        <textarea
          id="case-import-json"
          onChange={(event) => setJsonText(event.target.value)}
          rows={14}
          value={jsonText}
        />
      </div>
      <div className="button-row">
        <button onClick={handlePreview} type="button">
          导入预览
        </button>
        <button disabled={preview?.canImport === false} onClick={handleImport} type="button">
          导入案件
        </button>
      </div>
      {localError ? <ErrorState title="导入失败" message={localError} /> : null}
      {preview ? (
        <div className="nested-panel" role="status">
          <p>
            预览 <strong>{preview.name}</strong>：{preview.counts.characters} 个角色，{' '}
            {preview.counts.clues} 条线索，{preview.counts.events} 个事件。
          </p>
          {preview.canImport ? (
            <p className="badge">准备导入</p>
          ) : (
            <ul>
              {preview.conflicts.map((conflict) => (
                <li key={`${conflict.fieldName}:${conflict.value}`}>{conflict.message}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function formatActionError(error: unknown) {
  if (error instanceof StorageDomainError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知存储错误';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase();
}
