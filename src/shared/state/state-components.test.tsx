import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  LoadingState,
} from './index';

function ThrowingComponent(): never {
  throw new Error('render failed');
}

describe('shared state components', () => {
  it('renders loading status text', () => {
    render(<LoadingState message="Loading boards" />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading boards');
  });

  it('renders empty state title and message', () => {
    render(
      <EmptyState
        title="No cases yet"
        message="Create a case board to begin."
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'No cases yet' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Create a case board to begin.')).toBeInTheDocument();
  });

  it('renders error state as an alert', () => {
    render(
      <ErrorState title="Storage unavailable" message="Try reloading the app." />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Storage unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('Try reloading the app.');
  });

  it('catches render errors with the error boundary', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const onError = vi.fn();

    try {
      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>,
      );
    } finally {
      consoleError.mockRestore();
    }

    expect(screen.getByRole('alert')).toHaveTextContent(
      'MurderBoard hit an unexpected error.',
    );
    expect(onError).toHaveBeenCalled();
  });
});
