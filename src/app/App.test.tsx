import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the MurderBoard shell title', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: /murderboard/i }),
    ).toBeInTheDocument();
  });
});
