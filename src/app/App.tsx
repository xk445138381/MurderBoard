import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from '../shared/state';
import { createAppRouter } from './routes';

const router = createAppRouter();

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
