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
          <h1 id="evidence-title">线索管理</h1>
        </div>
        <p>记录线索、来源、内容和发现时间。</p>
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

      {errorMessage ? <ErrorState title="操作失败" message={errorMessage} /> : null}
      {isLoadingClues ? <LoadingState message="加载中..." /> : null}

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
            label="搜索线索"
            onSearchChange={setClueQuery}
            placeholder="按标题、来源、内容或日期筛选"
            searchValue={clueQuery}
          />
          <ClueList
            clues={filteredClues}
            emptyMessage={
              clues.length === 0
                ? '添加证据、证词或发现。'
                : '没有找到匹配的线索。'
            }
            emptyTitle={clues.length === 0 ? '暂无线索' : '未找到线索'}
            onDelete={(clueId) =>
              runAction(async () => {
                const clue = clues.find((candidate) => candidate.id === clueId);
                if (clue && !confirmDestructiveAction(`将线索"${clue.title}"移入回收站？`)) {
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
    <form aria-label="创建线索" className="panel form-grid" onSubmit={handleSubmit}>
      <h2>添加到 {caseName}</h2>
      <div>
        <label htmlFor="clue-title">标题</label>
        <input id="clue-title" onChange={(event) => setTitle(event.target.value)} value={title} />
      </div>
      <div>
        <label htmlFor="clue-source">来源</label>
        <input
          id="clue-source"
          onChange={(event) => setSource(event.target.value)}
          value={source}
        />
      </div>
      <div>
        <label htmlFor="clue-discovered-at">发现时间</label>
        <input
          id="clue-discovered-at"
          onChange={(event) => setDiscoveredAt(event.target.value)}
          placeholder="2026-01-01T20:00:00+08:00"
          value={discoveredAt}
        />
      </div>
      <div>
        <label htmlFor="clue-content">内容</label>
        <textarea
          id="clue-content"
          onChange={(event) => setContent(event.target.value)}
          rows={3}
          value={content}
        />
      </div>
      <button type="submit">创建线索</button>
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
    <div aria-label="线索列表" className="stack">
      <h2>线索</h2>
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
      <form aria-label={`编辑线索 ${clue.title}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">线索</p>
            <h3>{clue.title}</h3>
          </div>
          <span className="badge">{clue.source || '未标注来源'}</span>
        </div>
        <div>
          <label htmlFor={`clue-title-${clue.id}`}>标题</label>
          <input
            id={`clue-title-${clue.id}`}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </div>
        <div>
          <label htmlFor={`clue-source-${clue.id}`}>来源</label>
          <input
            id={`clue-source-${clue.id}`}
            onChange={(event) => setSource(event.target.value)}
            value={source}
          />
        </div>
        <div>
          <label htmlFor={`clue-discovered-at-${clue.id}`}>发现时间</label>
          <input
            id={`clue-discovered-at-${clue.id}`}
            onChange={(event) => setDiscoveredAt(event.target.value)}
            value={discoveredAt}
          />
        </div>
        <div>
          <label htmlFor={`clue-content-${clue.id}`}>内容</label>
          <textarea
            id={`clue-content-${clue.id}`}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            value={content}
          />
        </div>
        <div className="button-row">
          <button type="submit">保存线索</button>
          <button onClick={() => onDelete(clue.id)} type="button">
            删除线索
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
