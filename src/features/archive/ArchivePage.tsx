import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Case, Workspace } from '../../domain/types';
import { useMurderBoardRepository } from '../../shared/data/MurderBoardDataProvider';
import { EmptyState, ErrorState, LoadingState } from '../../shared/state';
import { StorageDomainError } from '../../storage/storage-error';

export function ArchivePage() {
  const repository = useMurderBoardRepository();
  const [archivedCases, setArchivedCases] = useState<Case[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [archiveQuery, setArchiveQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const filteredArchivedCases = useMemo(() => {
    const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace.name]));
    const query = normalizeSearchTerm(archiveQuery);
    if (!query) {
      return archivedCases;
    }

    return archivedCases.filter((caseRecord) =>
      [
        caseRecord.name,
        caseRecord.summary,
        caseRecord.archivedAt ?? caseRecord.updatedAt,
        workspaceById.get(caseRecord.workspaceId) ?? '',
      ].some((value) => normalizeSearchTerm(value).includes(query)),
    );
  }, [archiveQuery, archivedCases, workspaces]);

  const refreshArchive = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextArchivedCases, nextWorkspaces] = await Promise.all([
        repository.listArchivedCases(),
        repository.listWorkspaces(),
      ]);
      setArchivedCases(nextArchivedCases);
      setWorkspaces(nextWorkspaces);
    } catch (error) {
      setErrorMessage(formatActionError(error));
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void refreshArchive();
  }, [refreshArchive]);

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);

    try {
      await action();
      await refreshArchive();
    } catch (error) {
      setErrorMessage(formatActionError(error));
    }
  }

  return (
    <section aria-labelledby="archive-title" className="stack">
      <div className="page-heading">
        <div>
<h1 id="archive-title">归档管理</h1>
        </div>
        <p>
          通过在工作区创建新的活跃副本来恢复归档案件。原始归档案件保持不变。
        </p>
      </div>

      {errorMessage ? <ErrorState title="归档操作失败" message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="加载归档中..." /> : null}

      {archivedCases.length > 0 ? (
        <section aria-label="搜索归档案件" className="panel form-grid">
          <div>
            <label htmlFor="archive-search">搜索归档案件</label>
            <input
              id="archive-search"
              onChange={(event) => setArchiveQuery(event.target.value)}
              placeholder="按名称、摘要、工作区或归档时间筛选"
              value={archiveQuery}
            />
          </div>
        </section>
      ) : null}

      {!isLoading && archivedCases.length === 0 ? (
        <EmptyState
          title="暂无归档"
          message="来自案件页面的归档案件将显示在此处。"
        />
      ) : null}

      {!isLoading && archivedCases.length > 0 && filteredArchivedCases.length === 0 ? (
        <EmptyState title="未找到匹配的归档案件" message="调整归档搜索条件。" />
      ) : null}

      {filteredArchivedCases.length > 0 ? (
        <div aria-label="已归档案件" className="stack">
          {filteredArchivedCases.map((caseRecord) => (
            <ArchivedCaseCard
              caseRecord={caseRecord}
              key={caseRecord.id}
              onRestore={(input) =>
                runAction(async () => {
                  await repository.restoreArchivedCase(caseRecord.id, input);
                })
              }
              sourceWorkspace={workspaces.find(
                (workspace) => workspace.id === caseRecord.workspaceId,
              )}
              workspaces={workspaces}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface ArchivedCaseCardProps {
  caseRecord: Case;
  onRestore: (input: { targetWorkspaceId: string; name?: string }) => void;
  sourceWorkspace: Workspace | undefined;
  workspaces: Workspace[];
}

function ArchivedCaseCard({
  caseRecord,
  onRestore,
  sourceWorkspace,
  workspaces,
}: ArchivedCaseCardProps) {
  const [targetWorkspaceId, setTargetWorkspaceId] = useState(
    sourceWorkspace?.id ?? workspaces[0]?.id ?? '',
  );
  const [name, setName] = useState(`${caseRecord.name} copy`);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onRestore({
      targetWorkspaceId,
      name,
    });
  }

  return (
    <article className="panel">
      <form aria-label={`恢复已归档案件 ${caseRecord.name}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">已归档案件</p>
            <h2>{caseRecord.name}</h2>
            <p>{sourceWorkspace ? `来源 ${sourceWorkspace.name}` : '源工作区不可用'}</p>
          </div>
          <span className="badge">
            归档于 {formatDateTime(caseRecord.archivedAt ?? caseRecord.updatedAt)}
          </span>
        </div>
        {caseRecord.summary ? <p>{caseRecord.summary}</p> : null}
        <div>
          <label htmlFor={`archive-target-workspace-${caseRecord.id}`}>目标工作区</label>
          <select
            id={`archive-target-workspace-${caseRecord.id}`}
            onChange={(event) => setTargetWorkspaceId(event.target.value)}
            value={targetWorkspaceId}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`archive-restored-name-${caseRecord.id}`}>恢复后案件名称</label>
          <input
            id={`archive-restored-name-${caseRecord.id}`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <button disabled={!targetWorkspaceId} type="submit">
          恢复为新案件
        </button>
      </form>
    </article>
  );
}

function formatActionError(error: unknown) {
  if (error instanceof StorageDomainError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '未知归档错误';
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
