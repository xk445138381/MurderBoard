import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MurderBoardDataProvider } from '../../shared/data/MurderBoardDataProvider';
import { IndexedDbClient, IndexedDbMurderBoardRepository } from '../../storage/indexeddb';
import { TrashPage } from './TrashPage';

function uniqueDatabaseName() {
  return `murderboard-trash-page-test-${Math.random().toString(36).slice(2)}`;
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

function renderTrashPage(repository: IndexedDbMurderBoardRepository) {
  render(
    <MurderBoardDataProvider repository={repository}>
      <TrashPage />
    </MurderBoardDataProvider>,
  );
}

async function closeClient(client: IndexedDbClient) {
  const db = await client.init();
  db.close();
}

describe('TrashPage', () => {
  it('restores soft-deleted cases', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: 'Campaign' });
    const caseRecord = await repository.createCase(workspace.id, {
      name: 'First Night',
      status: 'active',
    });
    await repository.softDeleteCase(caseRecord.id);
    renderTrashPage(repository);

    const trashEntries = await screen.findByLabelText('回收站条目');
    const entry = within(trashEntries).getByRole('heading', { name: 'First Night' }).closest('article');
    expect(entry).not.toBeNull();

    await user.click(within(entry as HTMLElement).getByRole('button', { name: '恢复' }));

    expect(await screen.findByText('回收站为空')).toBeInTheDocument();
    expect(await repository.getCase(caseRecord.id)).toMatchObject({
      status: 'active',
      deletedAt: null,
    });

    await closeClient(client);
  });

  it('permanently deletes soft-deleted characters', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: 'Campaign' });
    const caseRecord = await repository.createCase(workspace.id, { name: 'First Night' });
    const character = await repository.createCharacter(caseRecord.id, { name: 'Detective' });
    await repository.softDeleteCharacter(character.id);
    renderTrashPage(repository);

    const trashEntries = await screen.findByLabelText('回收站条目');
    const entry = within(trashEntries).getByRole('heading', { name: 'Detective' }).closest('article');
    expect(entry).not.toBeNull();

    await user.click(
      within(entry as HTMLElement).getByRole('button', { name: '永久删除' }),
    );

    expect(await screen.findByText('回收站为空')).toBeInTheDocument();
    expect(await repository.listCharacters(caseRecord.id, { includeDeleted: true })).toEqual([]);

    await closeClient(client);
  });
});
