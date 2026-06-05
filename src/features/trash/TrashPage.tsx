import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmDestructiveAction } from '../../shared/confirm';
import { useMurderBoardRepository } from '../../shared/data/MurderBoardDataProvider';
import { EmptyState, ErrorState, LoadingState } from '../../shared/state';
import type { TrashEntry } from '../../storage/repositories';
import { StorageDomainError } from '../../storage/storage-error';

const RESOURCE_LABELS: Record<TrashEntry['resourceType'], string> = {
  workspace: 'Workspace',
  case: 'Case',
  character: 'Character',
  clue: 'Clue',
  event: 'Event',
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
          <p className="eyebrow">Phase 5</p>
          <h1 id="trash-title">Trash</h1>
        </div>
        <p>Review soft-deleted resources, restore recoverable items, or permanently delete them.</p>
      </div>

      {errorMessage ? <ErrorState title="Trash action failed" message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Loading trash..." /> : null}

      {trashEntries.length > 0 ? (
        <TrashFilters
          onResourceFilterChange={setResourceFilter}
          onTrashQueryChange={setTrashQuery}
          resourceFilter={resourceFilter}
          trashQuery={trashQuery}
        />
      ) : null}

      {!isLoading && trashEntries.length === 0 ? (
        <EmptyState title="Trash is empty" message="Deleted workspaces, cases, people, clues, and events appear here." />
      ) : null}

      {!isLoading && trashEntries.length > 0 && filteredTrashEntries.length === 0 ? (
        <EmptyState title="No trash entries found" message="Adjust the search or type filter." />
      ) : null}

      {filteredTrashEntries.length > 0 ? (
        <div aria-label="Trash entries" className="stack">
          {filteredTrashEntries.map((entry) => (
            <article className="panel" key={entry.id}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{RESOURCE_LABELS[entry.resourceType]}</p>
                  <h2>{entry.label}</h2>
                  {entry.parentLabel ? <p>From {entry.parentLabel}</p> : null}
                </div>
                <span className="badge">Deleted {formatDateTime(entry.deletedAt)}</span>
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
                  Restore
                </button>
                <button
                  onClick={() =>
                    runAction(async () => {
                      if (
                        !confirmDestructiveAction(
                          `Permanently delete ${RESOURCE_LABELS[entry.resourceType].toLowerCase()} "${entry.label}"? This cannot be undone.`,
                        )
                      ) {
                        return;
                      }
                      await repository.purgeTrashEntry(entry.resourceType, entry.resourceId);
                    })
                  }
                  type="button"
                >
                  Permanently delete
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
    <section aria-label="Filter trash" className="panel form-grid">
      <h2>Search and filter trash</h2>
      <div>
        <label htmlFor="trash-search">Search trash</label>
        <input
          id="trash-search"
          onChange={(event) => onTrashQueryChange(event.target.value)}
          placeholder="Filter by name, parent, type, or deleted time"
          value={trashQuery}
        />
      </div>
      <div>
        <label htmlFor="trash-type-filter">Type filter</label>
        <select
          id="trash-type-filter"
          onChange={(event) =>
            onResourceFilterChange(event.target.value as TrashEntry['resourceType'] | 'all')
          }
          value={resourceFilter}
        >
          <option value="all">All types</option>
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

  return 'Unknown trash error.';
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
