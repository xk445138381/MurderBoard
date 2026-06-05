import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Character, Clue, Event as CaseEvent } from '../../domain/types';
import { confirmDestructiveAction } from '../../shared/confirm';
import { CaseScopeSelector } from '../../shared/data/CaseScopeSelector';
import {
  formatActionError,
  useWorkspaceCaseSelection,
} from '../../shared/data/useWorkspaceCaseSelection';
import { EmptyState, ErrorState, LoadingState } from '../../shared/state';

interface EventRelations {
  characterIds: string[];
  clueIds: string[];
}

type EventRelationMap = Record<string, EventRelations>;

export function TimelinePage() {
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
  const [clues, setClues] = useState<Clue[]>([]);
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [eventQuery, setEventQuery] = useState('');
  const [eventRelations, setEventRelations] = useState<EventRelationMap>({});
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const filteredEvents = useMemo(() => {
    const query = normalizeSearchTerm(eventQuery);
    if (!query) {
      return events;
    }

    return events.filter((event) =>
      [
        event.title,
        event.description,
        event.occurredAt,
        describeRelations(characters, clues, eventRelations[event.id] ?? { characterIds: [], clueIds: [] }),
      ].some((value) => normalizeSearchTerm(value).includes(query)),
    );
  }, [characters, clues, eventQuery, eventRelations, events]);

  const loadTimeline = useCallback(async () => {
    if (!selectedCaseId) {
      setCharacters([]);
      setClues([]);
      setEvents([]);
      setEventRelations({});
      return;
    }

    setIsLoadingTimeline(true);
    setErrorMessage(null);

    try {
      const [nextCharacters, nextClues, nextEvents] = await Promise.all([
        repository.listCharacters(selectedCaseId),
        repository.listClues(selectedCaseId),
        repository.listEvents(selectedCaseId),
      ]);
      const relationEntries = await Promise.all(
        nextEvents.map(async (event) => {
          const [eventCharacters, eventClues] = await Promise.all([
            repository.listEventCharacters(event.id),
            repository.listEventClues(event.id),
          ]);
          return [
            event.id,
            {
              characterIds: eventCharacters.map((relation) => relation.characterId),
              clueIds: eventClues.map((relation) => relation.clueId),
            },
          ] as const;
        }),
      );

      setCharacters(nextCharacters);
      setClues(nextClues);
      setEvents(nextEvents);
      setEventRelations(Object.fromEntries(relationEntries));
    } catch (error) {
      setErrorMessage(formatActionError(error));
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [repository, selectedCaseId]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  async function runAction(action: () => Promise<void>) {
    setErrorMessage(null);

    try {
      await action();
      await loadTimeline();
    } catch (error) {
      setErrorMessage(formatActionError(error));
    }
  }

  return (
    <section aria-labelledby="timeline-title" className="stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Phase 4</p>
          <h1 id="timeline-title">Timeline</h1>
        </div>
        <p>Record story events, sort by occurrence time, and connect events to people and clues.</p>
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
      {isLoadingTimeline ? <LoadingState message="Loading timeline..." /> : null}

      {selectedCase ? (
        <>
          <CreateEventForm
            caseName={selectedCase.name}
            characters={characters}
            clues={clues}
            onCreate={(input) =>
              runAction(async () => {
                await repository.createEvent(selectedCase.id, input);
              })
            }
          />
          <ListSearch
            label="Search timeline events"
            onSearchChange={setEventQuery}
            placeholder="Filter by title, description, time, or linked records"
            searchValue={eventQuery}
          />
          <EventList
            characters={characters}
            clues={clues}
            eventRelations={eventRelations}
            events={filteredEvents}
            emptyMessage={
              events.length === 0
                ? 'Add events to build the case timeline.'
                : 'No timeline events match the current search.'
            }
            emptyTitle={events.length === 0 ? 'No events yet' : 'No events found'}
            onDelete={(eventId) =>
              runAction(async () => {
                const event = events.find((candidate) => candidate.id === eventId);
                if (event && !confirmDestructiveAction(`Move event "${event.title}" to trash?`)) {
                  return;
                }
                await repository.softDeleteEvent(eventId);
              })
            }
            onSave={(eventId, input) =>
              runAction(async () => {
                await repository.updateEvent(eventId, input);
              })
            }
          />
        </>
      ) : null}
    </section>
  );
}

interface EventInput {
  title: string;
  description?: string;
  occurredAt: string;
  relatedCharacterIds?: string[];
  relatedClueIds?: string[];
}

interface CreateEventFormProps {
  caseName: string;
  characters: Character[];
  clues: Clue[];
  onCreate: (input: EventInput) => void;
}

function CreateEventForm({ caseName, characters, clues, onCreate }: CreateEventFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [relatedCharacterIds, setRelatedCharacterIds] = useState<string[]>([]);
  const [relatedClueIds, setRelatedClueIds] = useState<string[]>([]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreate({
      title,
      description,
      occurredAt,
      relatedCharacterIds,
      relatedClueIds,
    });
    setTitle('');
    setDescription('');
    setOccurredAt('');
    setRelatedCharacterIds([]);
    setRelatedClueIds([]);
  }

  return (
    <form aria-label="Create event" className="panel form-grid" onSubmit={handleSubmit}>
      <h2>Add event to {caseName}</h2>
      <EventFields
        characters={characters}
        clues={clues}
        description={description}
        fieldId="create-event"
        occurredAt={occurredAt}
        onDescriptionChange={setDescription}
        onOccurredAtChange={setOccurredAt}
        onRelatedCharacterIdsChange={setRelatedCharacterIds}
        onRelatedClueIdsChange={setRelatedClueIds}
        onTitleChange={setTitle}
        relatedCharacterIds={relatedCharacterIds}
        relatedClueIds={relatedClueIds}
        title={title}
      />
      <button type="submit">Create event</button>
    </form>
  );
}

interface EventListProps {
  characters: Character[];
  clues: Clue[];
  emptyMessage: string;
  emptyTitle: string;
  eventRelations: EventRelationMap;
  events: CaseEvent[];
  onDelete: (eventId: string) => void;
  onSave: (eventId: string, input: EventInput) => void;
}

function EventList({
  characters,
  clues,
  emptyMessage,
  emptyTitle,
  eventRelations,
  events,
  onDelete,
  onSave,
}: EventListProps) {
  if (events.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div aria-label="Timeline event list" className="stack">
      <h2>Timeline events</h2>
      {events.map((event) => (
        <EventEditor
          characters={characters}
          clues={clues}
          event={event}
          key={event.id}
          onDelete={onDelete}
          onSave={onSave}
          relations={eventRelations[event.id] ?? { characterIds: [], clueIds: [] }}
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
        <label htmlFor="timeline-event-search">{label}</label>
        <input
          id="timeline-event-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          value={searchValue}
        />
      </div>
    </section>
  );
}

interface EventEditorProps {
  characters: Character[];
  clues: Clue[];
  event: CaseEvent;
  onDelete: (eventId: string) => void;
  onSave: (eventId: string, input: EventInput) => void;
  relations: EventRelations;
}

function EventEditor({
  characters,
  clues,
  event,
  onDelete,
  onSave,
  relations,
}: EventEditorProps) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [occurredAt, setOccurredAt] = useState(event.occurredAt);
  const [relatedCharacterIds, setRelatedCharacterIds] = useState(relations.characterIds);
  const [relatedClueIds, setRelatedClueIds] = useState(relations.clueIds);
  const relatedNames = useMemo(
    () => describeRelations(characters, clues, relations),
    [characters, clues, relations],
  );

  useEffect(() => {
    setTitle(event.title);
    setDescription(event.description);
    setOccurredAt(event.occurredAt);
    setRelatedCharacterIds(relations.characterIds);
    setRelatedClueIds(relations.clueIds);
  }, [event, relations]);

  function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    onSave(event.id, {
      title,
      description,
      occurredAt,
      relatedCharacterIds,
      relatedClueIds,
    });
  }

  return (
    <article className="panel">
      <form aria-label={`Edit event ${event.title}`} className="form-grid" onSubmit={handleSubmit}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Event</p>
            <h3>{event.title}</h3>
          </div>
          <span className="badge">{event.occurredAt}</span>
        </div>
        <p>{relatedNames}</p>
        <EventFields
          characters={characters}
          clues={clues}
          description={description}
          fieldId={`event-${event.id}`}
          occurredAt={occurredAt}
          onDescriptionChange={setDescription}
          onOccurredAtChange={setOccurredAt}
          onRelatedCharacterIdsChange={setRelatedCharacterIds}
          onRelatedClueIdsChange={setRelatedClueIds}
          onTitleChange={setTitle}
          relatedCharacterIds={relatedCharacterIds}
          relatedClueIds={relatedClueIds}
          title={title}
        />
        <div className="button-row">
          <button type="submit">Save event</button>
          <button onClick={() => onDelete(event.id)} type="button">
            Delete event
          </button>
        </div>
      </form>
    </article>
  );
}

interface EventFieldsProps {
  characters: Character[];
  clues: Clue[];
  description: string;
  fieldId: string;
  occurredAt: string;
  onDescriptionChange: (value: string) => void;
  onOccurredAtChange: (value: string) => void;
  onRelatedCharacterIdsChange: (value: string[]) => void;
  onRelatedClueIdsChange: (value: string[]) => void;
  onTitleChange: (value: string) => void;
  relatedCharacterIds: string[];
  relatedClueIds: string[];
  title: string;
}

function EventFields({
  characters,
  clues,
  description,
  fieldId,
  occurredAt,
  onDescriptionChange,
  onOccurredAtChange,
  onRelatedCharacterIdsChange,
  onRelatedClueIdsChange,
  onTitleChange,
  relatedCharacterIds,
  relatedClueIds,
  title,
}: EventFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor={`${fieldId}-title`}>Title</label>
        <input
          id={`${fieldId}-title`}
          onChange={(event) => onTitleChange(event.target.value)}
          value={title}
        />
      </div>
      <div>
        <label htmlFor={`${fieldId}-occurred-at`}>Occurred at</label>
        <input
          id={`${fieldId}-occurred-at`}
          onChange={(event) => onOccurredAtChange(event.target.value)}
          placeholder="2026-01-01T20:00:00+08:00"
          value={occurredAt}
        />
      </div>
      <div>
        <label htmlFor={`${fieldId}-description`}>Description</label>
        <textarea
          id={`${fieldId}-description`}
          onChange={(event) => onDescriptionChange(event.target.value)}
          rows={3}
          value={description}
        />
      </div>
      <RelationCheckboxes
        label="Related characters"
        onSelectionChange={onRelatedCharacterIdsChange}
        options={characters.map((character) => ({ id: character.id, label: character.name }))}
        selectedIds={relatedCharacterIds}
      />
      <RelationCheckboxes
        label="Related clues"
        onSelectionChange={onRelatedClueIdsChange}
        options={clues.map((clue) => ({ id: clue.id, label: clue.title }))}
        selectedIds={relatedClueIds}
      />
    </>
  );
}

interface RelationCheckboxesProps {
  label: string;
  onSelectionChange: (value: string[]) => void;
  options: { id: string; label: string }[];
  selectedIds: string[];
}

function RelationCheckboxes({
  label,
  onSelectionChange,
  options,
  selectedIds,
}: RelationCheckboxesProps) {
  if (options.length === 0) {
    return (
      <fieldset className="relation-fieldset">
        <legend>{label}</legend>
        <p>No records available.</p>
      </fieldset>
    );
  }

  return (
    <fieldset className="relation-fieldset">
      <legend>{label}</legend>
      {options.map((option) => (
        <label className="checkbox-row" key={option.id}>
          <input
            checked={selectedIds.includes(option.id)}
            onChange={(event) =>
              onSelectionChange(toggleSelection(selectedIds, option.id, event.target.checked))
            }
            type="checkbox"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function toggleSelection(selectedIds: string[], id: string, isSelected: boolean) {
  if (isSelected) {
    return selectedIds.includes(id) ? selectedIds : [...selectedIds, id];
  }

  return selectedIds.filter((selectedId) => selectedId !== id);
}

function describeRelations(characters: Character[], clues: Clue[], relations: EventRelations) {
  const characterNames = characters
    .filter((character) => relations.characterIds.includes(character.id))
    .map((character) => character.name);
  const clueTitles = clues
    .filter((clue) => relations.clueIds.includes(clue.id))
    .map((clue) => clue.title);
  const parts = [
    characterNames.length ? `Characters: ${characterNames.join(', ')}` : null,
    clueTitles.length ? `Clues: ${clueTitles.join(', ')}` : null,
  ].filter(Boolean);

  return parts.join(' · ') || 'No related characters or clues.';
}

function normalizeSearchTerm(value: string) {
  return value.trim().toLocaleLowerCase();
}
