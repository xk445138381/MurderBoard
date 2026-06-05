import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Clue } from '../../domain/types';
import { confirmDestructiveAction } from '../../shared/confirm';
import { CaseScopeSelector } from '../../shared/data/CaseScopeSelector';
import {
  formatActionError,
  useWorkspaceCaseSelection,
} from '../../shared/data/useWorkspaceCaseSelection';
import { EmptyState, ErrorState, LoadingState } from '../../shared/state';

export function EvidencePage() {
  const {
    cases,
    isLoadingScope,
    repository,
    scopeError,
    selectWorkspace,
    selectedCase,
    selectedCaseId,
    selectedWorkspaceId,
    setSelectedCaseId,
    workspaces,
  } = useWorkspaceCaseSelection();
  const [clues, setClues] = useState<Clue[]>([]);
  const [clueQuery, setClueQuery] = useState('');
  const [isLoadingClues, setIsLoadingClues] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const filteredClues = useMemo(() => {
    const query = normalizeSearchTerm(clueQuery);
    if (!query) {
      return clues;
    }

    return clues.filter((clue) =>
      [clue.title, clue.content, clue.source, clue.discoveredAt ?? ''].some((value) =>
        normalizeSearchTerm(value).includes(query),
      ),
    );
  }, [clueQuery, clues]);

  const loadClues = useCallback(async () => {
    if (!selectedCaseId) {
      setClues([]);
      return;
    }

    setIsLoadingClues(true);
    setErrorMessage(null);

    try {
      setClues(await repository.listClues(selectedCaseId));
    } catch (error) {
      setErrorMessage(formatActionError(error));
    } finally {
      setIsLoadingClues(false);
    }
  }, [repository, selectedCaseId]);

  useEffect(() => {
    void loadClues();
  }, [loadClues]);

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);

    try {
      await action();
      await loadClues();
    } catch (error) {
      setErrorMessage(formatActionError(error));
    }
  }

  return (
    <section aria-labelledby="evidence-title" className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Phase 4</p>
          <h1 id="evidence-title">Evidence</h1>
        </div>
        <p>Capture clues, sources, content, and structured discovery times.</p>
      </div>

      <CaseScopeSelector
        cases={cases}
        isLoading={isLoadingScope}
        onCaseChange={setSelectedCaseId}
        onWorkspaceChange={(workspaceId) => {
          void selectWorkspace(workspaceId);
        }}
        scopeError={scopeError}
        selectedCaseId={selectedCaseId}
        selectedWorkspaceId={selectedWorkspaceId}
        workspaces={workspaces}
      />

      {errorMessage ? <ErrorState title="Action failed" message={errorMessage} /> : null}
      {isLoadingClues ? <LoadingState message="Loading clues..." /> : null}

      {selectedCase ? (
        <>
          <CreateClueForm
            caseName={selectedCase.name}
            onCreate={(input) =>
              runAction(async () => {
                await repository.createClue(selectedCase.id, input);
              })
            }
          />
          <ListSearch
            label="Search clues"
            onSearchChange={setClueQuery}
            placeholder="Filter by title, source, content, or date"
            searchValue={clueQuery}
          />
          <ClueList
            clues={filteredClues}
            emptyMessage={
              clues.length === 0
                ? 'Add evidence, testimony, or discoveries.'
                : 'No clues match the current search.'
            }
            emptyTitle={clues.length === 0 ? 'No clues yet' : 'No clues found'}
            onDelete={(clueId) =>
              runAction(async () => {
                const clue = clues.find((candidate) => candidate.id === clueId);
                if (clue && !confirmDestructiveAction(`Move clue "${clue.title}" to trash?`)) {
                  return;
                }
                await repository.softDeleteClue(clueId);
              })
            }
            onSave={(clueId, input) =>
              runAction(async () => {
                await repository.updateClue(clueId, input);
              })
            }
          />
        </>
      ) : null}
    </section>
  );
}

interface ClueInput {
  title: string;
  content?: string;
  source?: string;
  discoveredAt?: string | null;
}

interface CreateClueFormProps {
  caseName: string;
  onCreate: (input: ClueInput) => void;
}

function CreateClueForm({ caseName, onCreate }: CreateClueFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('');
  const [discoveredAt, setDiscoveredAt] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      title,
      content,
      source,
      discoveredAt: normalizeOptionalDate(discoveredAt),
    });
    setTitle('');
    setContent('');
    setSource('');
    setDiscoveredAt('');
  }

  return (
    <form aria-label="Create clue" className="panel form-grid" onSubmit={handleSubmit}>
      <h2>Add clue to {caseName}</h2>
      <div>
        <label htmlFor="clue-title">Title</label>
        <input id="clue-title" onChange={(event) => setTitle(event.target.value)} value={title} />
      </div>
      <div>
        <label htmlFor="clue-source">Source</label>
        <input
          id="clue-source"
          onChange={(event) => setSource(event.target.value)}
          value={source}
        />
      </div>
      <div>
        <label htmlFor="clue-discovered-at">Discovered at</label>
        <input
          id="clue-discovered-at"
          onChange={(event) => setDiscoveredAt(event.target.value)}
          placeholder="2026-01-01T20:00:00+08:00"
          value={discoveredAt}
        />
      </div>
      <div>
        <label htmlFor="clue-content">Content</label>
        <textarea
          id="clue-content"
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          value={content}
        />
      </div>
      <button type="submit">Create clue</button>
    </form>
  );
}

interface ClueListProps {
  clues: Clue[];
  emptyMessage: string;
  emptyTitle: string;
  onDelete: (clueId: string) => void;
  onSave: (clueId: string, input: ClueInput) => void;
}

function ClueList({ clues, emptyMessage, emptyTitle, onDelete, onSave }: ClueListProps) {
  if (clues.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div aria-label="Clue list" className="stack">
      <h2>Clues</h2>
      {clues.map((clue) => (
        <ClueEditor clue={clue} key={clue.id} onDelete={onDelete} onSave={onSave} />
      ))}
    </div>
  );
}

interface ListSearchProps {
  label: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  searchValue: string;
}

function ListSearch({ label, onSearchChange, placeholder, searchValue }: ListSearchProps) {
  return (
    <section aria-label={label} className="panel form-grid">
      <div>
        <label htmlFor="clue-list-search">{label}</label>
        <input
          id="clue-list-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          value={searchValue}
        />
      </div>
    </section>
  );
}

interface ClueEditorProps {
  clue: Clue;
  onDelete: (clueId: string) => void;
  onSave: (clueId: string, input: ClueInput) => void;
}

function ClueEditor({ clue, onDelete, onSave }: ClueEditorProps) {
  const [title, setTitle] = useState(clue.title);
  const [content, setContent] = useState(clue.content);
  const [source, setSource] = useState(clue.source);
  const [discoveredAt, setDiscoveredAt] = useState(clue.discoveredAt ?? '');

  useEffect(() => {
    setTitle(clue.title);
    setContent(clue.content);
    setSource(clue.source);
    setDiscoveredAt(clue.discoveredAt ?? '');
  }, [clue]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(clue.id, {
      title,
      content,
      source,
      discoveredAt: normalizeOptionalDate(discoveredAt),
    });
  }

  return (
    <article className="panel">
      <form aria-label={`Edit clue ${clue.title}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Clue</p>
            <h3>{clue.title}</h3>
          </div>
          <span className="badge">{clue.source || 'No source'}</span>
        </div>
        <div>
          <label htmlFor={`clue-title-${clue.id}`}>Title</label>
          <input
            id={`clue-title-${clue.id}`}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </div>
        <div>
          <label htmlFor={`clue-source-${clue.id}`}>Source</label>
          <input
            id={`clue-source-${clue.id}`}
            onChange={(event) => setSource(event.target.value)}
            value={source}
          />
        </div>
        <div>
          <label htmlFor={`clue-discovered-at-${clue.id}`}>Discovered at</label>
          <input
            id={`clue-discovered-at-${clue.id}`}
            onChange={(event) => setDiscoveredAt(event.target.value)}
            value={discoveredAt}
          />
        </div>
        <div>
          <label htmlFor={`clue-content-${clue.id}`}>Content</label>
          <textarea
            id={`clue-content-${clue.id}`}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            value={content}
          />
        </div>
        <div className="button-row">
          <button type="submit">Save clue</button>
          <button onClick={() => onDelete(clue.id)} type="button">
            Delete clue
          </button>
        </div>
      </form>
    </article>
  );
}

function normalizeOptionalDate(value: string) {
  return value.trim() || null;
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase();
}
