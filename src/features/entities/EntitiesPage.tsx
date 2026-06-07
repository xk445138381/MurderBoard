import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Character } from '../../domain/types';
import { confirmDestructiveAction } from '../../shared/confirm';
import { CaseScopeSelector } from '../../shared/data/CaseScopeSelector';
import {
  formatActionError,
  useWorkspaceCaseSelection,
} from '../../shared/data/useWorkspaceCaseSelection';
import { EmptyState, ErrorState, LoadingState } from '../../shared/state';

export function EntitiesPage() {
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
  const [characters, setCharacters] = useState<Character[]>([]);
  const [characterQuery, setCharacterQuery] = useState('');
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const filteredCharacters = useMemo(() => {
    const query = normalizeSearchTerm(characterQuery);
    if (!query) {
      return characters;
    }

    return characters.filter((character) =>
      [character.name, character.role, character.notes].some((value) =>
        normalizeSearchTerm(value).includes(query),
      ),
    );
  }, [characterQuery, characters]);

  const loadCharacters = useCallback(async () => {
    if (!selectedCaseId) {
      setCharacters([]);
      return;
    }

    setIsLoadingCharacters(true);
    setErrorMessage(null);

    try {
      setCharacters(await repository.listCharacters(selectedCaseId));
    } catch (error) {
      setErrorMessage(formatActionError(error));
    } finally {
      setIsLoadingCharacters(false);
    }
  }, [repository, selectedCaseId]);

  useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);

    try {
      await action();
      await loadCharacters();
    } catch (error) {
      setErrorMessage(formatActionError(error));
    }
  }

  return (
    <section aria-labelledby="entities-title" className="stack">
      <div className="page-heading">
        <div>
          <h1 id="entities-title">人物管理</h1>
        </div>
        <p>记录当前案件的涉案人物，包括角色和备注。</p>
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
      {isLoadingCharacters ? <LoadingState message="加载中..." /> : null}

      {selectedCase ? (
        <>
          <CreateCharacterForm
            caseName={selectedCase.name}
            onCreate={(input) =>
              runAction(async () => {
                await repository.createCharacter(selectedCase.id, input);
              })
            }
          />
          <ListSearch
            label="搜索人物"
            onSearchChange={setCharacterQuery}
            placeholder="按姓名、角色或备注筛选"
            searchValue={characterQuery}
          />
          <CharacterList
            characters={filteredCharacters}
            emptyMessage={
              characters.length === 0
                ? '添加嫌疑人、证人和玩家。'
                : '没有找到匹配的人物。'
            }
            emptyTitle={characters.length === 0 ? '暂无人物' : '未找到人物'}
            onDelete={(characterId) =>
              runAction(async () => {
                const character = characters.find((candidate) => candidate.id === characterId);
                if (
                  character &&
                  !confirmDestructiveAction(`将人物"${character.name}"移入回收站？`)
                ) {
                  return;
                }
                await repository.softDeleteCharacter(characterId);
              })
            }
            onSave={(characterId, input) =>
              runAction(async () => {
                await repository.updateCharacter(characterId, input);
              })
            }
          />
        </>
      ) : null}
    </section>
  );
}

interface CreateCharacterFormProps {
  caseName: string;
  onCreate: (input: { name: string; role?: string; notes?: string }) => void;
}

function CreateCharacterForm({ caseName, onCreate }: CreateCharacterFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({ name, role, notes });
    setName('');
    setRole('');
    setNotes('');
  }

  return (
    <form aria-label="创建人物" className="panel form-grid" onSubmit={handleSubmit}>
      <h2>添加到 {caseName}</h2>
      <div>
        <label htmlFor="character-name">姓名</label>
        <input
          id="character-name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>
      <div>
        <label htmlFor="character-role">角色</label>
        <input
          id="character-role"
          onChange={(event) => setRole(event.target.value)}
          value={role}
        />
      </div>
      <div>
        <label htmlFor="character-notes">备注</label>
        <textarea
          id="character-notes"
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          value={notes}
        />
      </div>
      <button type="submit">创建人物</button>
    </form>
  );
}

interface CharacterListProps {
  characters: Character[];
  emptyMessage: string;
  emptyTitle: string;
  onDelete: (characterId: string) => void;
  onSave: (characterId: string, input: { name?: string; role?: string; notes?: string }) => void;
}

function CharacterList({
  characters,
  emptyMessage,
  emptyTitle,
  onDelete,
  onSave,
}: CharacterListProps) {
  if (characters.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div aria-label="人物列表" className="stack">
      <h2>人物</h2>
      {characters.map((character) => (
        <CharacterEditor
          character={character}
          key={character.id}
          onDelete={onDelete}
          onSave={onSave}
        />
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
        <label htmlFor="character-list-search">{label}</label>
        <input
          id="character-list-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          value={searchValue}
        />
      </div>
    </section>
  );
}

interface CharacterEditorProps {
  character: Character;
  onDelete: (characterId: string) => void;
  onSave: (characterId: string, input: { name?: string; role?: string; notes?: string }) => void;
}

function CharacterEditor({ character, onDelete, onSave }: CharacterEditorProps) {
  const [name, setName] = useState(character.name);
  const [role, setRole] = useState(character.role);
  const [notes, setNotes] = useState(character.notes);

  useEffect(() => {
    setName(character.name);
    setRole(character.role);
    setNotes(character.notes);
  }, [character]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(character.id, { name, role, notes });
  }

  return (
    <article className="panel">
      <form aria-label={`编辑人物 ${character.name}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">人物</p>
            <h3>{character.name}</h3>
          </div>
          <span className="badge">{character.role || '未设定'}</span>
        </div>
        <div>
          <label htmlFor={`character-name-${character.id}`}>姓名</label>
          <input
            id={`character-name-${character.id}`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div>
          <label htmlFor={`character-role-${character.id}`}>角色</label>
          <input
            id={`character-role-${character.id}`}
            onChange={(event) => setRole(event.target.value)}
            value={role}
          />
        </div>
        <div>
          <label htmlFor={`character-notes-${character.id}`}>备注</label>
          <textarea
            id={`character-notes-${character.id}`}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            value={notes}
          />
        </div>
        <div className="button-row">
          <button type="submit">保存人物</button>
          <button onClick={() => onDelete(character.id)} type="button">
            删除人物
          </button>
        </div>
      </form>
    </article>
  );
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase();
}
