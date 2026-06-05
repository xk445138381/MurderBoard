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
          <p className="eyebrow">Phase 7</p>
          <h1 id="cases-title">Cases</h1>
        </div>
        <p>
          Create, search, copy, move, import, archive, and trash local-first mystery cases.
        </p>
      </div>

      {errorMessage ? <ErrorState title="Action failed" message={errorMessage} /> : null}
      {isLoading ? <LoadingState message="Loading case boards..." /> : null}

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
          title="No workspaces yet"
          message="Create a workspace to group related mystery cases."
        />
      ) : null}

      {workspaces.length > 0 ? (
        <div className="case-management-grid">
          <aside className="panel form-grid" aria-label="Workspaces">
            <h2>Workspaces</h2>
            <label htmlFor="workspace-search">Search workspaces</label>
            <input
              id="workspace-search"
              onChange={(event) => setWorkspaceQuery(event.target.value)}
              placeholder="Filter by name or description"
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
                  <small>{workspace.description || 'No description'}</small>
                </button>
              ))}
            </div>
            {filteredWorkspaces.length === 0 ? (
              <p className="muted">No workspaces match the current search.</p>
            ) : null}
          </aside>

          <div className="stack">
            {selectedWorkspace ? (
              <>
                <WorkspaceEditor
                  workspace={selectedWorkspace}
                  onDelete={() =>
                    runAction(async () => {
                      if (!confirmDestructiveAction(`Move workspace "${selectedWorkspace.name}" to trash?`)) {
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
                      ? 'Create a case inside the selected workspace.'
                      : 'No cases match the current search or status filter.'
                  }
                  emptyTitle={cases.length === 0 ? 'No cases yet' : 'No cases found'}
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
                        !confirmDestructiveAction(`Move case "${caseRecord.name}" to trash?`)
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
    <form aria-label="Create workspace" className="panel form-grid" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="workspace-name">Workspace name</label>
        <input
          id="workspace-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Red Chamber Mystery"
          value={name}
        />
      </div>
      <div>
        <label htmlFor="workspace-description">Description</label>
        <input
          id="workspace-description"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional story or campaign notes"
          value={description}
        />
      </div>
      <button type="submit">Create workspace</button>
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
    <form aria-label="Edit workspace" className="panel form-grid" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Selected workspace</p>
          <h2>{workspace.name}</h2>
        </div>
        <span className="badge">Updated {formatDateTime(workspace.updatedAt)}</span>
      </div>
      <div>
        <label htmlFor="selected-workspace-name">Workspace name</label>
        <input
          id="selected-workspace-name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>
      <div>
        <label htmlFor="selected-workspace-description">Description</label>
        <textarea
          id="selected-workspace-description"
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          value={description}
        />
      </div>
      <div className="button-row">
        <button type="submit">Save workspace</button>
        <button onClick={onDelete} type="button">
          Delete workspace
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
    <section aria-label="Filter cases" className="panel form-grid">
      <h2>Search and filter cases</h2>
      <div>
        <label htmlFor="case-search">Search cases</label>
        <input
          id="case-search"
          onChange={(event) => onCaseQueryChange(event.target.value)}
          placeholder="Filter by name, summary, or status"
          value={caseQuery}
        />
      </div>
      <div>
        <label htmlFor="case-status-filter">Status filter</label>
        <select
          id="case-status-filter"
          onChange={(event) =>
            onStatusFilterChange(event.target.value as RestorableCaseStatus | 'all')
          }
          value={statusFilter}
        >
          <option value="all">All statuses</option>
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
    <form aria-label="Create case" className="panel form-grid" onSubmit={handleSubmit}>
      <h2>Create case</h2>
      <div>
        <label htmlFor="case-name">Case name</label>
        <input
          id="case-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. First Night"
          value={name}
        />
      </div>
      <div>
        <label htmlFor="case-summary">Summary</label>
        <textarea
          id="case-summary"
          onChange={(event) => setSummary(event.target.value)}
          rows={3}
          value={summary}
        />
      </div>
      <div>
        <label htmlFor="case-status">Status</label>
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
      <button type="submit">Create case</button>
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
    <div className="stack" aria-label="Cases list">
      <h2>Cases in workspace</h2>
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
  const [copyName, setCopyName] = useState(`Copy of ${caseRecord.name}`);
  const [copyTargetWorkspaceId, setCopyTargetWorkspaceId] = useState(caseRecord.workspaceId);
  const [moveName, setMoveName] = useState(caseRecord.name);
  const [moveTargetWorkspaceId, setMoveTargetWorkspaceId] = useState(caseRecord.workspaceId);

  useEffect(() => {
    setName(caseRecord.name);
    setSummary(caseRecord.summary);
    setStatus(caseRecord.status === 'deleted' ? 'draft' : caseRecord.status);
    setCopyName(`Copy of ${caseRecord.name}`);
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
      <form aria-label={`Edit case ${caseRecord.name}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Case detail</p>
            <h3>{caseRecord.name}</h3>
          </div>
          <span className="badge">{caseRecord.status}</span>
        </div>
        <div>
          <label htmlFor={`case-name-${caseRecord.id}`}>Case name</label>
          <input
            id={`case-name-${caseRecord.id}`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div>
          <label htmlFor={`case-summary-${caseRecord.id}`}>Summary</label>
          <textarea
            id={`case-summary-${caseRecord.id}`}
            onChange={(event) => setSummary(event.target.value)}
            rows={3}
            value={summary}
          />
        </div>
        <div>
          <label htmlFor={`case-status-${caseRecord.id}`}>Status</label>
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
          <button type="submit">Save case</button>
          <button
            disabled={caseRecord.status === 'archived'}
            onClick={() => onArchive(caseRecord.id)}
            type="button"
          >
            Archive case
          </button>
          <button onClick={() => onDelete(caseRecord.id)} type="button">
            Delete case
          </button>
        </div>
      </form>
      <section aria-label={`Copy or move case ${caseRecord.name}`} className="form-grid nested-panel">
        <h4>Copy or move</h4>
        <div>
          <label htmlFor={`case-copy-name-${caseRecord.id}`}>Copy name</label>
          <input
            id={`case-copy-name-${caseRecord.id}`}
            onChange={(event) => setCopyName(event.target.value)}
            value={copyName}
          />
        </div>
        <div>
          <label htmlFor={`case-copy-workspace-${caseRecord.id}`}>Copy target workspace</label>
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
          Copy case
        </button>
        <div>
          <label htmlFor={`case-move-name-${caseRecord.id}`}>Move name</label>
          <input
            id={`case-move-name-${caseRecord.id}`}
            onChange={(event) => setMoveName(event.target.value)}
            value={moveName}
          />
        </div>
        <div>
          <label htmlFor={`case-move-workspace-${caseRecord.id}`}>Move target workspace</label>
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
          Move case
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
      setLocalError(`Invalid import JSON: ${message}`);
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
    <section aria-label="Import case JSON" className="panel form-grid">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Import</p>
          <h2>Import case JSON</h2>
        </div>
      </div>
      <p className="muted">
        Paste a case snapshot, preview name conflicts, then import it into the selected workspace.
      </p>
      <div>
        <label htmlFor="case-import-json">Case JSON</label>
        <textarea
          id="case-import-json"
          onChange={(event) => setJsonText(event.target.value)}
          rows={14}
          value={jsonText}
        />
      </div>
      <div className="button-row">
        <button onClick={handlePreview} type="button">
          Preview import
        </button>
        <button disabled={preview?.canImport === false} onClick={handleImport} type="button">
          Import case
        </button>
      </div>
      {localError ? <ErrorState title="Import failed" message={localError} /> : null}
      {preview ? (
        <div className="nested-panel" role="status">
          <p>
            Previewed <strong>{preview.name}</strong>: {preview.counts.characters} characters,{' '}
            {preview.counts.clues} clues, {preview.counts.events} events.
          </p>
          {preview.canImport ? (
            <p className="badge">Ready to import</p>
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

  return 'Unknown storage error.';
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
