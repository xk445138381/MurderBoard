import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../routes';

describe('AppLayout', () => {
  it('renders navigation for the main product areas', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('link', { name: 'Cases' })).toHaveAttribute(
      'href',
      '/cases',
    );
    expect(screen.getByRole('link', { name: 'Timeline' })).toHaveAttribute(
      'href',
      '/timeline',
    );
    expect(screen.getByRole('link', { name: 'Trash' })).toHaveAttribute(
      'href',
      '/trash',
    );
    expect(screen.getByRole('link', { name: 'Archive' })).toHaveAttribute(
      'href',
      '/archive',
    );
  });
});
