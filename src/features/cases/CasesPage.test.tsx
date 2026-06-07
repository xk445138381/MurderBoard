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

    expect(await screen.findByRole('heading', { name: '案件管理' })).toBeInTheDocument();

    const createWorkspaceForm = screen.getByRole('form', { name: '创建工作区' });
    await user.type(within(createWorkspaceForm).getByLabelText('工作区名称'), 'Baker Street');
    await user.type(
      within(createWorkspaceForm).getByLabelText('描述'),
      'Holmes campaign',
    );
    await user.click(within(createWorkspaceForm).getByRole('button', { name: '创建工作区' }));

    expect(await screen.findByRole('heading', { name: 'Baker Street' })).toBeInTheDocument();

    const createCaseForm = screen.getByRole('form', { name: '创建案件' });
    await user.type(within(createCaseForm).getByLabelText('案件名称'), 'First Night');
    await user.type(within(createCaseForm).getByLabelText('摘要'), 'A locked room opening.');
    await user.selectOptions(within(createCaseForm).getByLabelText('状态'), 'active');
    await user.click(within(createCaseForm).getByRole('button', { name: '创建案件' }));

    const caseForm = await screen.findByRole('form', { name: '编辑案件 First Night' });
    expect(within(caseForm).getByText('active', { selector: '.badge' })).toBeInTheDocument();

    await closeClient(client);
  });

  it('shows duplicate workspace errors without losing the page', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    renderCasesPage(repository);

    const createWorkspaceForm = await screen.findByRole('form', { name: '创建工作区' });
    await user.type(within(createWorkspaceForm).getByLabelText('工作区名称'), 'Duplicate');
    await user.click(within(createWorkspaceForm).getByRole('button', { name: '创建工作区' }));
    await screen.findByRole('heading', { name: 'Duplicate' });

    await user.type(within(createWorkspaceForm).getByLabelText('工作区名称'), 'Duplicate');
    await user.click(within(createWorkspaceForm).getByRole('button', { name: '创建工作区' }));

    expect(
      await screen.findByText('Workspace name "Duplicate" already exists.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '案件管理' })).toBeInTheDocument();

    await closeClient(client);
  });

  it('renames cases, changes status, and archives cases', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const workspace = await repository.createWorkspace({ name: 'Campaign' });
    await repository.createCase(workspace.id, { name: 'First Night' });
    renderCasesPage(repository);

    const caseForm = await screen.findByRole('form', { name: '编辑案件 First Night' });
    await user.clear(within(caseForm).getByLabelText('案件名称'));
    await user.type(within(caseForm).getByLabelText('案件名称'), 'Second Night');
    await user.selectOptions(within(caseForm).getByLabelText('状态'), 'active');
    await user.click(within(caseForm).getByRole('button', { name: '保存案件' }));

    const renamedCaseForm = await screen.findByRole('form', { name: '编辑案件 Second Night' });
    expect(within(renamedCaseForm).getByDisplayValue('Second Night')).toBeInTheDocument();
    expect(within(renamedCaseForm).getByText('active', { selector: '.badge' })).toBeInTheDocument();

    await user.click(within(renamedCaseForm).getByRole('button', { name: '归档案件' }));

    const archivedCaseForm = await screen.findByRole('form', { name: '编辑案件 Second Night' });
    expect(within(archivedCaseForm).getByText('archived', { selector: '.badge' })).toBeInTheDocument();
    expect(within(archivedCaseForm).getByRole('button', { name: '归档案件' })).toBeDisabled();

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

    expect(await screen.findByRole('form', { name: '编辑案件 Alpha case' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: '编辑案件 Beta case' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('搜索案件'), { target: { value: 'library' } });

    expect(screen.getByRole('form', { name: '编辑案件 Alpha case' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: '编辑案件 Beta case' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('搜索案件'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('状态筛选'), { target: { value: 'draft' } });

    expect(await screen.findByRole('form', { name: '编辑案件 Beta case' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: '编辑案件 Alpha case' })).not.toBeInTheDocument();

    await closeClient(client);
  });

  it('copies cases into another workspace from the cases page', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const targetWorkspace = await repository.createWorkspace({ name: 'Target' });
    const sourceWorkspace = await repository.createWorkspace({ name: 'Source' });
    await repository.createCase(sourceWorkspace.id, { name: 'First Night', status: 'active' });
    renderCasesPage(repository);

    await screen.findByRole('form', { name: '编辑案件 First Night' });
    const copyMovePanel = screen.getByRole('region', { name: '复制或移动案件 First Night' });
    fireEvent.change(within(copyMovePanel).getByLabelText('复制名称'), {
      target: { value: 'Copied Night' },
    });
    const targetLabels = within(copyMovePanel).getAllByLabelText('目标工作区');
    await user.selectOptions(targetLabels[0], targetWorkspace.id);
    await user.click(within(copyMovePanel).getByRole('button', { name: '复制案件' }));

    expect(await screen.findByRole('form', { name: '编辑案件 Copied Night' })).toBeInTheDocument();
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
    const importSection = screen.getByRole('region', { name: '导入案件 JSON' });
    await user.click(within(importSection).getByRole('button', { name: '导入预览' }));

    expect(
      await screen.findByText('Case name "Imported Case" already exists in the selected workspace.'),
    ).toBeInTheDocument();

    fireEvent.change(within(importSection).getByLabelText('案件 JSON'), {
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
    await user.click(within(importSection).getByRole('button', { name: '导入预览' }));
    expect(await screen.findByText('准备导入')).toBeInTheDocument();
    await user.click(within(importSection).getByRole('button', { name: '导入案件' }));

    expect(await screen.findByRole('form', { name: '编辑案件 Fresh Import' })).toBeInTheDocument();

    await closeClient(client);
  });
});
