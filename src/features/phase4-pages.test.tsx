import { render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { MurderBoardDataProvider } from '../shared/data/MurderBoardDataProvider';
import { IndexedDbClient, IndexedDbMurderBoardRepository } from '../storage/indexeddb';
import { EntitiesPage } from './entities/EntitiesPage';
import { EvidencePage } from './evidence/EvidencePage';
import { TimelinePage } from './timeline/TimelinePage';

function uniqueDatabaseName() {
  return `murderboard-phase4-page-test-${Math.random().toString(36).slice(2)}`;
}

function createRepository() {
  let idSequence = 0;
  let clockSequence = 0;
  const client = new IndexedDbClient({ dbName: uniqueDatabaseName() });
  const repository = new IndexedDbMurderBoardRepository({
    client,
    idFactory: () => `id-${++idSequence}`,
    now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, clockSequence++)).toISOString(),
  });

  return { client, repository };
}

async function createCaseScope(repository: IndexedDbMurderBoardRepository) {
  const workspace = await repository.createWorkspace({ name: 'Campaign' });
  const caseRecord = await repository.createCase(workspace.id, { name: 'First Night' });
  return { caseRecord, workspace };
}

function renderWithRepository(
  repository: IndexedDbMurderBoardRepository,
  page: ReactElement,
) {
  render(<MurderBoardDataProvider repository={repository}>{page}</MurderBoardDataProvider>);
}

async function closeClient(client: IndexedDbClient) {
  const db = await client.init();
  db.close();
}

describe('phase 4 pages', () => {
  it('creates, edits, and soft-deletes characters', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    await createCaseScope(repository);
    renderWithRepository(repository, <EntitiesPage />);

    const createForm = await screen.findByRole('form', { name: 'Create character' });
    await user.type(within(createForm).getByLabelText('Name'), 'Detective');
    await user.type(within(createForm).getByLabelText('Role'), 'Investigator');
    await user.type(within(createForm).getByLabelText('Notes'), 'Keeps a private notebook.');
    await user.click(within(createForm).getByRole('button', { name: 'Create character' }));

    const editForm = await screen.findByRole('form', { name: 'Edit character Detective' });
    await user.clear(within(editForm).getByLabelText('Name'));
    await user.type(within(editForm).getByLabelText('Name'), 'Senior Detective');
    await user.click(within(editForm).getByRole('button', { name: 'Save character' }));

    const renamedForm = await screen.findByRole('form', {
      name: 'Edit character Senior Detective',
    });
    expect(within(renamedForm).getByDisplayValue('Senior Detective')).toBeInTheDocument();

    await user.click(within(renamedForm).getByRole('button', { name: 'Delete character' }));

    expect(await screen.findByText('No characters yet')).toBeInTheDocument();
    await closeClient(client);
  });

  it('creates, edits, and soft-deletes clues', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    await createCaseScope(repository);
    renderWithRepository(repository, <EvidencePage />);

    const createForm = await screen.findByRole('form', { name: 'Create clue' });
    await user.type(within(createForm).getByLabelText('Title'), 'Pocket watch');
    await user.type(within(createForm).getByLabelText('Source'), 'Library');
    await user.type(
      within(createForm).getByLabelText('Discovered at'),
      '2026-01-01T20:00:00+08:00',
    );
    await user.type(within(createForm).getByLabelText('Content'), 'Stopped at 8 PM.');
    await user.click(within(createForm).getByRole('button', { name: 'Create clue' }));

    const editForm = await screen.findByRole('form', { name: 'Edit clue Pocket watch' });
    await user.clear(within(editForm).getByLabelText('Title'));
    await user.type(within(editForm).getByLabelText('Title'), 'Broken pocket watch');
    await user.click(within(editForm).getByRole('button', { name: 'Save clue' }));

    const renamedForm = await screen.findByRole('form', {
      name: 'Edit clue Broken pocket watch',
    });
    expect(within(renamedForm).getByDisplayValue('Broken pocket watch')).toBeInTheDocument();

    await user.click(within(renamedForm).getByRole('button', { name: 'Delete clue' }));

    expect(await screen.findByText('No clues yet')).toBeInTheDocument();
    await closeClient(client);
  });

  it('creates related events, sorts the timeline, edits events, and soft-deletes events', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const { caseRecord } = await createCaseScope(repository);
    await repository.createCharacter(caseRecord.id, { name: 'Detective' });
    await repository.createClue(caseRecord.id, { title: 'Footprint' });
    renderWithRepository(repository, <TimelinePage />);

    const createForm = await screen.findByRole('form', { name: 'Create event' });
    await user.type(within(createForm).getByLabelText('Title'), 'Later event');
    await user.type(
      within(createForm).getByLabelText('Occurred at'),
      '2026-01-01T20:00:00+08:00',
    );
    await user.click(within(createForm).getByLabelText('Detective'));
    await user.click(within(createForm).getByLabelText('Footprint'));
    await user.click(within(createForm).getByRole('button', { name: 'Create event' }));

    expect(await screen.findByText('Characters: Detective · Clues: Footprint')).toBeInTheDocument();

    const secondCreateForm = screen.getByRole('form', { name: 'Create event' });
    await user.type(within(secondCreateForm).getByLabelText('Title'), 'Earlier event');
    await user.type(
      within(secondCreateForm).getByLabelText('Occurred at'),
      '2026-01-01T19:00:00+08:00',
    );
    await user.click(within(secondCreateForm).getByRole('button', { name: 'Create event' }));

    const earlierHeading = await screen.findByRole('heading', { name: 'Earlier event' });
    const laterHeading = screen.getByRole('heading', { name: 'Later event' });
    expect(
      earlierHeading.compareDocumentPosition(laterHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const editForm = screen.getByRole('form', { name: 'Edit event Earlier event' });
    await user.clear(within(editForm).getByLabelText('Title'));
    await user.type(within(editForm).getByLabelText('Title'), 'Earliest event');
    await user.click(within(editForm).getByRole('button', { name: 'Save event' }));

    const renamedForm = await screen.findByRole('form', { name: 'Edit event Earliest event' });
    await user.click(within(renamedForm).getByRole('button', { name: 'Delete event' }));

    expect(await screen.findByRole('heading', { name: 'Later event' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Earliest event' })).not.toBeInTheDocument();
    await closeClient(client);
  });
});
