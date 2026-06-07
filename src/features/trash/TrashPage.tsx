import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmDestructiveAction } from '../../shared/confirm';
import { useMurderBoardRepository } from '../../shared/data/MurderBoardDataProvider';
import { EmptyState, ErrorState, LoadingState } from '../../shared/state';
import type { TrashEntry } from '../../storage/repositories';
import { StorageDomainError } from '../../storage/storage-error';

const RESOURCE_LABELS: Record<TrashEntry['resourceType'], string> = {
  workspace: '工作区',
  case: '案件',
  character: '人物',
  clue: '线索',
  event: '事件',
};

export function TrashPage() {
  const repository = useMurderBoardRepository();
  const [trashEntries, setTrashEntries] = useState<TrashEntry[]>([]);
  const [trashQuery, setTrashQuery] = useState('');
  const [resourceFilter, setResourceFilter] = useState<TrashEntry['resourceType'] | 'all'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const filteredTrashEntries = useMemo(() => {
    const query = normalizeSearchTerm(trashQuery);
    return trashEntries
      .filter((entry) => resourceFilter === 'all' || entry.resourceType === resourceFilter)
      .filter((entry) => {
        if (!query) {
          return true;
        }

        return [
          entry.label,
          entry.parentLabel,
          RESOURCE_LABELS[entry.resourceType],
          entry.deletedAt,
        ].some((value) => normalizeSearchTerm(value).includes(query));
      });
  }, [resourceFilter, trashEntries, trashQuery]);

  const refreshTrash = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      setTrashEntries(await repository.listTrashEntries());
    } catch (error) {
      setErrorMessage(formatActionError(error));
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void refreshTrash();
  }, [refreshTrash]);

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);

    try {
      await action();
      await refreshTrash();
    } catch (error) {
      setErrorMessage(formatActionError(error));
    }
  }

  return (
    <section aria-labelledby="trash-title" className="stack">
      <div className="page-heading">
        <div>
<h1 id="trash-title">回收站</h1>
        </div>
        <p>查看已软删除的资源，恢复可恢复的项目，或永久删除它们。</p>
      </div>

      {errorMessage ? <ErrorState title="回收站操作失败" message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="加载回收站中..." /> : null}

      {trashEntries.length > 0 ? (
        <TrashFilters
          onResourceFilterChange={setResourceFilter}
          onTrashQueryChange={setTrashQuery}
          resourceFilter={resourceFilter}
          trashQuery={trashQuery}
        />
      ) : null}

      {!isLoading && trashEntries.length === 0 ? (
        <EmptyState title="回收站为空" message="已删除的工作区、案件、人物、线索和事件将显示在此处。" />
      ) : null}

      {!isLoading && trashEntries.length > 0 && filteredTrashEntries.length === 0 ? (
        <EmptyState title="未找到匹配的回收站条目" message="调整搜索或类型筛选条件。" />
      ) : null}

      {filteredTrashEntries.length > 0 ? (
        <div aria-label="回收站条目" className="stack">
          {filteredTrashEntries.map((entry) => (
            <article className="panel" key={entry.id}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{RESOURCE_LABELS[entry.resourceType]}</p>
                  <h2>{entry.label}</h2>
                  {entry.parentLabel ? <p>来源 {entry.parentLabel}</p> : null}
                </div>
                <span className="badge">删除于 {formatDateTime(entry.deletedAt)}</span>
              </div>
              <div className="button-row">
                <button
                  onClick={() =>
                    runAction(async () => {
                      await repository.restoreTrashEntry(entry.resourceType, entry.resourceId);
                    })
                  }
                  type="button"
                >
                  恢复
                </button>
                <button
                  onClick={() =>
                    runAction(async () => {
                      if (
                        !confirmDestructiveAction(
                          `确定要永久删除 ${RESOURCE_LABELS[entry.resourceType].toLowerCase()} "${entry.label}"？此操作不可撤销。`,
                        )
                      ) {
                        return;
                      }
                      await repository.purgeTrashEntry(entry.resourceType, entry.resourceId);
                    })
                  }
                  type="button"
                >
                  永久删除
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface TrashFiltersProps {
  onResourceFilterChange: (value: TrashEntry['resourceType'] | 'all') => void;
  onTrashQueryChange: (value: string) => void;
  resourceFilter: TrashEntry['resourceType'] | 'all';
  trashQuery: string;
}

function TrashFilters({
  onResourceFilterChange,
  onTrashQueryChange,
  resourceFilter,
  trashQuery,
}: TrashFiltersProps) {
  return (
    <section aria-label="筛选回收站" className="panel form-grid">
      <h2>搜索和筛选回收站</h2>
      <div>
        <label htmlFor="trash-search">搜索回收站</label>
        <input
          id="trash-search"
          onChange={(event) => onTrashQueryChange(event.target.value)}
          placeholder="按名称、来源、类型或删除时间筛选"
          value={trashQuery}
        />
      </div>
      <div>
        <label htmlFor="trash-type-filter">类型筛选</label>
        <select
          id="trash-type-filter"
          onChange={(event) =>
            onResourceFilterChange(event.target.value as TrashEntry['resourceType'] | 'all')
          }
          value={resourceFilter}
        >
          <option value="all">全部类型</option>
          {(Object.keys(RESOURCE_LABELS) as TrashEntry['resourceType'][]).map((resourceType) => (
            <option key={resourceType} value={resourceType}>
              {RESOURCE_LABELS[resourceType]}
            </option>
          ))}
        </select>
      </div>
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

  return '未知回收站错误';
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
