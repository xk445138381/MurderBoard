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
          <p className="eyebrow">Phase 6</p>
          <h1 id="archive-title">Archive</h1>
        </div>
        <p>
          Restore archived cases by creating a new active copy in the selected workspace. The
          original archived case stays unchanged.
        </p>
      </div>

      {errorMessage ? <ErrorState title="Archive action failed" message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Loading archive..." /> : null}

      {archivedCases.length > 0 ? (
        <section aria-label="Search archived cases" className="panel form-grid">
          <div>
            <label htmlFor="archive-search">Search archived cases</label>
            <input
              id="archive-search"
              onChange={(event) => setArchiveQuery(event.target.value)}
              placeholder="Filter by name, summary, workspace, or archive time"
              value={archiveQuery}
            />
          </div>
        </section>
      ) : null}

      {!isLoading && archivedCases.length === 0 ? (
        <EmptyState
          title="Archive is empty"
          message="Archived cases from the Cases page appear here."
        />
      ) : null}

      {!isLoading && archivedCases.length > 0 && filteredArchivedCases.length === 0 ? (
        <EmptyState title="No archived cases found" message="Adjust the archive search." />
      ) : null}

      {filteredArchivedCases.length > 0 ? (
        <div aria-label="Archived cases" className="stack">
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
      <form aria-label={`Restore archived case ${caseRecord.name}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Archived case</p>
            <h2>{caseRecord.name}</h2>
            <p>{sourceWorkspace ? `From ${sourceWorkspace.name}` : 'Source workspace unavailable'}</p>
          </div>
          <span className="badge">
            Archived {formatDateTime(caseRecord.archivedAt ?? caseRecord.updatedAt)}
          </span>
        </div>
        {caseRecord.summary ? <p>{caseRecord.summary}</p> : null}
        <div>
          <label htmlFor={`archive-target-workspace-${caseRecord.id}`}>Target workspace</label>
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
          <label htmlFor={`archive-restored-name-${caseRecord.id}`}>Restored case name</label>
          <input
            id={`archive-restored-name-${caseRecord.id}`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <button disabled={!targetWorkspaceId} type="submit">
          Restore as new case
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

  return 'Unknown archive error.';
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
