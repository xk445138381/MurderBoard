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
          <p className="eyebrow">Phase 4</p>
          <h1 id="entities-title">Entities</h1>
        </div>
        <p>Record characters for the selected case, including role and notes.</p>
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
      {isLoadingCharacters ? <LoadingState message="Loading characters..." /> : null}

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
            label="Search characters"
            onSearchChange={setCharacterQuery}
            placeholder="Filter by name, role, or notes"
            searchValue={characterQuery}
          />
          <CharacterList
            characters={filteredCharacters}
            emptyMessage={
              characters.length === 0
                ? 'Add suspects, witnesses, and players.'
                : 'No characters match the current search.'
            }
            emptyTitle={characters.length === 0 ? 'No characters yet' : 'No characters found'}
            onDelete={(characterId) =>
              runAction(async () => {
                const character = characters.find((candidate) => candidate.id === characterId);
                if (
                  character &&
                  !confirmDestructiveAction(`Move character "${character.name}" to trash?`)
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
    <form aria-label="Create character" className="panel form-grid" onSubmit={handleSubmit}>
      <h2>Add character to {caseName}</h2>
      <div>
        <label htmlFor="character-name">Name</label>
        <input
          id="character-name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>
      <div>
        <label htmlFor="character-role">Role</label>
        <input
          id="character-role"
          onChange={(event) => setRole(event.target.value)}
          value={role}
        />
      </div>
      <div>
        <label htmlFor="character-notes">Notes</label>
        <textarea
          id="character-notes"
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          value={notes}
        />
      </div>
      <button type="submit">Create character</button>
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
    <div aria-label="Character list" className="stack">
      <h2>Characters</h2>
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
      <form aria-label={`Edit character ${character.name}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Character</p>
            <h3>{character.name}</h3>
          </div>
          <span className="badge">{character.role || 'No role'}</span>
        </div>
        <div>
          <label htmlFor={`character-name-${character.id}`}>Name</label>
          <input
            id={`character-name-${character.id}`}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
        </div>
        <div>
          <label htmlFor={`character-role-${character.id}`}>Role</label>
          <input
            id={`character-role-${character.id}`}
            onChange={(event) => setRole(event.target.value)}
            value={role}
          />
        </div>
        <div>
          <label htmlFor={`character-notes-${character.id}`}>Notes</label>
          <textarea
            id={`character-notes-${character.id}`}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            value={notes}
          />
        </div>
        <div className="button-row">
          <button type="submit">Save character</button>
          <button onClick={() => onDelete(character.id)} type="button">
            Delete character
          </button>
        </div>
      </form>
    </article>
  );
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase();
}
