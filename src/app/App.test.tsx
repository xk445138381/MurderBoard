import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

describe('App routes', () => {
  it('renders the MurderBoard home route', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', { name: 'MurderBoard' }),
    ).toBeInTheDocument();
  });
});
