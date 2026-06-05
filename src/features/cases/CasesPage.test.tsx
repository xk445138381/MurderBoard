import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MurderBoardDataProvider } from '../../shared/data/MurderBoardDataProvider';
import { IndexedDbClient, IndexedDbMurderBoardRepository } from '../../storage/indexeddb';
import { CasesPage } from './CasesPage';

function uniqueDatabaseName() {
  return `murderboard-cases-page-test-${Math.random().toString(36).slice(2)}`;
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

function renderCasesPage(repository: IndexedDbMurderBoardRepository) {
  render(
    <MurderBoardDataProvider repository={repository}>
      <CasesPage />
    </MurderBoardDataProvider>,
  );
}

async function closeClient(client: IndexedDbClient) {
  const db = await client.init();
  db.close();
}

describe('CasesPage', () => {
  it('creates a workspace and a case in the selected workspace', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    renderCasesPage(repository);

    expect(await screen.findByRole('heading', { name: 'Cases' })).toBeInTheDocument();

    const createWorkspaceForm = screen.getByRole('form', { name: 'Create workspace' });
    await user.type(within(createWorkspaceForm).getByLabelText('Workspace name'), 'Baker Street');
    await user.type(
      within(createWorkspaceForm).getByLabelText('Description'),
      'Holmes campaign',
    );
    await user.click(within(createWorkspaceForm).getByRole('button', { name: 'Create workspace' }));

    expect(await screen.findByRole('heading', { name: 'Baker Street' })).toBeInTheDocument();

    const createCaseForm = screen.getByRole('form', { name: 'Create case' });
    await user.type(within(createCaseForm).getByLabelText('Case name'), 'First Night');
    await user.type(within(createCaseForm).getByLabelText('Summary'), 'A locked room opening.');
    await user.selectOptions(within(createCaseForm).getByLabelText('Status'), 'active');
    await user.click(within(createCaseForm).getByRole('button', { name: 'Create case' }));

    const caseForm = await screen.findByRole('form', { name: 'Edit case First Night' });
    expect(within(caseForm).getByText('active', { selector: '.badge' })).toBeInTheDocument();

    await closeClient(client);
  });

  it('shows duplicate workspace errors without losing the page', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    renderCasesPage(repository);

    const createWorkspaceForm = await screen.findByRole('form', { name: 'Create workspace' });
    await user.type(within(createWorkspaceForm).getByLabelText('Workspace name'), 'Duplicate');
    await user.click(within(createWorkspaceForm).getByRole('button', { name: 'Create workspace' }));
    await screen.findByRole('heading', { name: 'Duplicate' });

    await user.type(within(createWorkspaceForm).getByLabelText('Workspace name'), 'Duplicate');
    await user.click(within(createWorkspaceForm).getByRole('button', { name: 'Create workspace' }));

    expect(
      await screen.findByText('Workspace name "Duplicate" already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cases' })).toBeInTheDocument();

    await closeClient(client);
  });

  it('renames cases, changes status, and archives cases', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: 'Campaign' });
    await repository.createCase(workspace.id, { name: 'First Night' });
    renderCasesPage(repository);

    const caseForm = await screen.findByRole('form', { name: 'Edit case First Night' });
    await user.clear(within(caseForm).getByLabelText('Case name'));
    await user.type(within(caseForm).getByLabelText('Case name'), 'Second Night');
    await user.selectOptions(within(caseForm).getByLabelText('Status'), 'active');
    await user.click(within(caseForm).getByRole('button', { name: 'Save case' }));

    const renamedCaseForm = await screen.findByRole('form', { name: 'Edit case Second Night' });
    expect(within(renamedCaseForm).getByDisplayValue('Second Night')).toBeInTheDocument();
    expect(within(renamedCaseForm).getByText('active', { selector: '.badge' })).toBeInTheDocument();

    await user.click(within(renamedCaseForm).getByRole('button', { name: 'Archive case' }));

    const archivedCaseForm = await screen.findByRole('form', { name: 'Edit case Second Night' });
    expect(within(archivedCaseForm).getByText('archived', { selector: '.badge' })).toBeInTheDocument();
    expect(within(archivedCaseForm).getByRole('button', { name: 'Archive case' })).toBeDisabled();

    await closeClient(client);
  });

  it('searches and filters cases in the selected workspace', async () => {
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: 'Campaign' });
    await repository.createCase(workspace.id, {
      name: 'Alpha case',
      summary: 'Hidden library',
      status: 'active',
    });
    await repository.createCase(workspace.id, {
      name: 'Beta case',
      summary: 'Garden witness',
      status: 'draft',
    });
    renderCasesPage(repository);

    expect(await screen.findByRole('form', { name: 'Edit case Alpha case' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Edit case Beta case' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: 'library' } });

    expect(screen.getByRole('form', { name: 'Edit case Alpha case' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Edit case Beta case' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search cases'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Status filter'), { target: { value: 'draft' } });

    expect(await screen.findByRole('form', { name: 'Edit case Beta case' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Edit case Alpha case' })).not.toBeInTheDocument();

    await closeClient(client);
  });

  it('copies cases into another workspace from the cases page', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const targetWorkspace = await repository.createWorkspace({ name: 'Target' });
    const sourceWorkspace = await repository.createWorkspace({ name: 'Source' });
    await repository.createCase(sourceWorkspace.id, { name: 'First Night', status: 'active' });
    renderCasesPage(repository);

    await screen.findByRole('form', { name: 'Edit case First Night' });
    const copyMovePanel = screen.getByRole('region', { name: 'Copy or move case First Night' });
    fireEvent.change(within(copyMovePanel).getByLabelText('Copy name'), {
      target: { value: 'Copied Night' },
    });
    await user.selectOptions(
      within(copyMovePanel).getByLabelText('Copy target workspace'),
      targetWorkspace.id,
    );
    await user.click(within(copyMovePanel).getByRole('button', { name: 'Copy case' }));

    expect(await screen.findByRole('form', { name: 'Edit case Copied Night' })).toBeInTheDocument();
    expect(await repository.listCases(sourceWorkspace.id)).toHaveLength(1);
    expect(await repository.listCases(targetWorkspace.id)).toHaveLength(1);

    await closeClient(client);
  });

  it('previews import conflicts before importing case JSON', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: 'Campaign' });
    await repository.createCase(workspace.id, { name: 'Imported Case' });
    renderCasesPage(repository);

    await screen.findByRole('heading', { name: 'Campaign' });
    const importSection = screen.getByRole('region', { name: 'Import case JSON' });
    await user.click(within(importSection).getByRole('button', { name: 'Preview import' }));

    expect(
      await screen.findByText('Case name "Imported Case" already exists in the selected workspace.'),
    ).toBeInTheDocument();

    fireEvent.change(within(importSection).getByLabelText('Case JSON'), {
      target: {
        value: JSON.stringify({
          name: 'Fresh Import',
          summary: 'Ready to ingest',
          characters: [{ name: 'Detective' }],
          clues: [{ title: 'Letter' }],
          events: [
            {
              title: 'Letter found',
              occurredAt: '2026-01-01T20:00:00+08:00',
              relatedCharacterNames: ['Detective'],
              relatedClueTitles: ['Letter'],
            },
          ],
        }),
      },
    });
    await user.click(within(importSection).getByRole('button', { name: 'Preview import' }));
    expect(await screen.findByText('Ready to import')).toBeInTheDocument();
    await user.click(within(importSection).getByRole('button', { name: 'Import case' }));

    expect(await screen.findByRole('form', { name: 'Edit case Fresh Import' })).toBeInTheDocument();

    await closeClient(client);
  });
});
