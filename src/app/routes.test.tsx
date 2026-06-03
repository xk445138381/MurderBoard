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
    ['/cases', 'Cases'],
    ['/entities', 'Entities'],
    ['/timeline', 'Timeline'],
    ['/evidence', 'Evidence'],
    ['/notes', 'Notes'],
    ['/trash', 'Trash'],
    ['/archive', 'Archive'],
  ])('renders %s', async (path, heading) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { name: heading }),
    ).toBeInTheDocument();
  });
});
