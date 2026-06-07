import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });

  render(<RouterProvider router={router} />);
}

describe('routes', () => {
  it.each([
    ['/', 'MurderBoard'],
    ['/board', 'MurderBoard'],
    ['/cases', '案件管理'],
    ['/entities', '人物管理'],
    ['/timeline', '时间线管理'],
    ['/evidence', '线索管理'],
    ['/notes', '笔记'],
    ['/trash', '回收站'],
    ['/archive', '归档管理'],
  ])('renders %s', async (path, heading) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
  });
});
