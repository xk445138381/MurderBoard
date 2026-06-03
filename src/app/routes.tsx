import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { RouteError } from './layout/RouteError';
import { ArchivePage } from '../features/archive/ArchivePage';
import { CasesPage } from '../features/cases/CasesPage';
import { EntitiesPage } from '../features/entities/EntitiesPage';
import { EvidencePage } from '../features/evidence/EvidencePage';
import { HomePage } from '../features/home/HomePage';
import { NotesPage } from '../features/notes/NotesPage';
import { TimelinePage } from '../features/timeline/TimelinePage';
import { TrashPage } from '../features/trash/TrashPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'cases', element: <CasesPage /> },
      { path: 'entities', element: <EntitiesPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'evidence', element: <EvidencePage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'trash', element: <TrashPage /> },
      { path: 'archive', element: <ArchivePage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
