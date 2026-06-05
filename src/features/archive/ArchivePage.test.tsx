import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MurderBoardDataProvider } from '../../shared/data/MurderBoardDataProvider';
import { IndexedDbClient, IndexedDbMurderBoardRepository } from '../../storage/indexeddb';
import { ArchivePage } from './ArchivePage';

function uniqueDatabaseName() {
  return `murderboard-archive-page-test-${Math.random().toString(36).slice(2)}`;
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

function renderArchivePage(repository: IndexedDbMurderBoardRepository) {
  render(
    <MurderBoardDataProvider repository={repository}>
      <ArchivePage />
    </MurderBoardDataProvider>,
  );
}

async function closeClient(client: IndexedDbClient) {
  const db = await client.init();
  db.close();
}

describe('ArchivePage', () => {
  it('restores archived cases as new cases in the target workspace', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const sourceWorkspace = await repository.createWorkspace({ name: 'Source campaign' });
    const targetWorkspace = await repository.createWorkspace({ name: 'Target campaign' });
    const sourceCase = await repository.createCase(sourceWorkspace.id, {
      name: 'First Night',
      status: 'active',
    });
    await repository.createCharacter(sourceCase.id, { name: 'Detective' });
    await repository.archiveCase(sourceCase.id);
    renderArchivePage(repository);

    const restoreForm = await screen.findByRole('form', {
      name: 'Restore archived case First Night',
    });
    await user.selectOptions(
      within(restoreForm).getByLabelText('Target workspace'),
      targetWorkspace.id,
    );
    await user.clear(within(restoreForm).getByLabelText('Restored case name'));
    await user.type(within(restoreForm).getByLabelText('Restored case name'), 'First Night Replay');
    await user.click(within(restoreForm).getByRole('button', { name: 'Restore as new case' }));

    const targetCases = await repository.listCases(targetWorkspace.id);
    expect(targetCases).toEqual([
      expect.objectContaining({
        name: 'First Night Replay',
        status: 'active',
      }),
    ]);
    expect(await repository.listCharacters(targetCases[0].id)).toEqual([
      expect.objectContaining({
        name: 'Detective',
      }),
    ]);
    expect(await repository.getCase(sourceCase.id)).toMatchObject({
      id: sourceCase.id,
      status: 'archived',
    });

    await closeClient(client);
  });

  it('shows duplicate-name errors when archive restore would conflict', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: 'Campaign' });
    const archivedCase = await repository.createCase(workspace.id, { name: 'First Night' });
    await repository.createCase(workspace.id, { name: 'Existing Case' });
    await repository.archiveCase(archivedCase.id);
    renderArchivePage(repository);

    const restoreForm = await screen.findByRole('form', {
      name: 'Restore archived case First Night',
    });
    await user.clear(within(restoreForm).getByLabelText('Restored case name'));
    await user.type(within(restoreForm).getByLabelText('Restored case name'), 'Existing Case');
    await user.click(within(restoreForm).getByRole('button', { name: 'Restore as new case' }));

    expect(
      await screen.findByText(`Case name "Existing Case" already exists in workspace "${workspace.id}".`),
    ).toBeInTheDocument();

    await closeClient(client);
  });
});
