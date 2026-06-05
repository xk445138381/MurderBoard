import { RouterProvider } from 'react-router-dom';
import { MurderBoardDataProvider } from '../shared/data/MurderBoardDataProvider';
import { ErrorBoundary } from '../shared/state';
import { createAppRouter } from './routes';

const router = createAppRouter();

export function App() {
  return (
    <ErrorBoundary>
      <MurderBoardDataProvider>
        <RouterProvider router={router} />
      </MurderBoardDataProvider>
    </ErrorBoundary>
  );
}
