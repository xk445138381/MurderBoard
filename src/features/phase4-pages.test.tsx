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

    const createForm = await screen.findByRole('form', { name: '创建人物' });
    await user.type(within(createForm).getByLabelText('姓名'), 'Detective');
    await user.type(within(createForm).getByLabelText('角色'), 'Investigator');
    await user.type(within(createForm).getByLabelText('备注'), 'Keeps a private notebook.');
    await user.click(within(createForm).getByRole('button', { name: '创建人物' }));

    const editForm = await screen.findByRole('form', { name: '编辑人物 Detective' });
    await user.clear(within(editForm).getByLabelText('姓名'));
    await user.type(within(editForm).getByLabelText('姓名'), 'Senior Detective');
    await user.click(within(editForm).getByRole('button', { name: '保存人物' }));

    const renamedForm = await screen.findByRole('form', {
      name: '编辑人物 Senior Detective',
    });
    expect(within(renamedForm).getByDisplayValue('Senior Detective')).toBeInTheDocument();

    await user.click(within(renamedForm).getByRole('button', { name: '删除人物' }));

    expect(await screen.findByText('暂无人物')).toBeInTheDocument();
    await closeClient(client);
  });

  it('creates, edits, and soft-deletes clues', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    await createCaseScope(repository);
    renderWithRepository(repository, <EvidencePage />);

    const createForm = await screen.findByRole('form', { name: '创建线索' });
    await user.type(within(createForm).getByLabelText('标题'), 'Pocket watch');
    await user.type(within(createForm).getByLabelText('来源'), 'Library');
    await user.type(
      within(createForm).getByLabelText('发现时间'),
      '2026-01-01T20:00:00+08:00',
    );
    await user.type(within(createForm).getByLabelText('内容'), 'Stopped at 8 PM.');
    await user.click(within(createForm).getByRole('button', { name: '创建线索' }));

    const editForm = await screen.findByRole('form', { name: '编辑线索 Pocket watch' });
    await user.clear(within(editForm).getByLabelText('标题'));
    await user.type(within(editForm).getByLabelText('标题'), 'Broken pocket watch');
    await user.click(within(editForm).getByRole('button', { name: '保存线索' }));

    const renamedForm = await screen.findByRole('form', {
      name: '编辑线索 Broken pocket watch',
    });
    expect(within(renamedForm).getByDisplayValue('Broken pocket watch')).toBeInTheDocument();

    await user.click(within(renamedForm).getByRole('button', { name: '删除线索' }));

    expect(await screen.findByText('暂无线索')).toBeInTheDocument();
    await closeClient(client);
  });

  it('creates related events, sorts the timeline, edits events, and soft-deletes events', async () => {
    const user = userEvent.setup();
    const { client, repository } = createRepository();
    const { caseRecord } = await createCaseScope(repository);
    await repository.createCharacter(caseRecord.id, { name: 'Detective' });
    await repository.createClue(caseRecord.id, { title: 'Footprint' });
    renderWithRepository(repository, <TimelinePage />);

    const createForm = await screen.findByRole('form', { name: '创建事件' });
    await user.type(within(createForm).getByLabelText('标题'), 'Later event');
    await user.type(
      within(createForm).getByLabelText('发生时间'),
      '2026-01-01T20:00:00+08:00',
    );
    await user.click(within(createForm).getByLabelText('Detective'));
    await user.click(within(createForm).getByLabelText('Footprint'));
    await user.click(within(createForm).getByRole('button', { name: '创建事件' }));

    expect(await screen.findByText('人物：Detective · 线索：Footprint')).toBeInTheDocument();

    const secondCreateForm = screen.getByRole('form', { name: '创建事件' });
    await user.type(within(secondCreateForm).getByLabelText('标题'), 'Earlier event');
    await user.type(
      within(secondCreateForm).getByLabelText('发生时间'),
      '2026-01-01T19:00:00+08:00',
    );
    await user.click(within(secondCreateForm).getByRole('button', { name: '创建事件' }));

    const earlierHeading = await screen.findByRole('heading', { name: 'Earlier event' });
    const laterHeading = screen.getByRole('heading', { name: 'Later event' });
    expect(
      earlierHeading.compareDocumentPosition(laterHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const editForm = screen.getByRole('form', { name: '编辑事件 Earlier event' });
    await user.clear(within(editForm).getByLabelText('标题'));
    await user.type(within(editForm).getByLabelText('标题'), 'Earliest event');
    await user.click(within(editForm).getByRole('button', { name: '保存事件' }));

    const renamedForm = await screen.findByRole('form', { name: '编辑事件 Earliest event' });
    await user.click(within(renamedForm).getByRole('button', { name: '删除事件' }));

    expect(await screen.findByRole('heading', { name: 'Later event' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Earliest event' })).not.toBeInTheDocument();
    await closeClient(client);
  });
});
