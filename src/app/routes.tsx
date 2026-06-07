import GameCreatePage from '../features/games/GameCreatePage';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { RouteError } from './layout/RouteError';
import { ArchivePage } from '../features/archive/ArchivePage';
import { BoardPage } from '../features/board/BoardPage';
import { CasesPage } from '../features/cases/CasesPage';
import { EntitiesPage } from '../features/entities/EntitiesPage';
import { EvidencePage } from '../features/evidence/EvidencePage';
import { NotesPage } from '../features/notes/NotesPage';
import { TimelinePage } from '../features/timeline/TimelinePage';
import { TrashPage } from '../features/trash/TrashPage';
import TemplateLibraryPage from '../features/templates/TemplateLibraryPage';
import NewBoardPage from '../features/board/NewBoardPage';
import TemplateEditor from '../features/templates/TemplateEditor';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <BoardPage /> },
      { path: 'board', element: <BoardPage /> },
      { path: 'cases', element: <CasesPage /> },
      { path: 'entities', element: <EntitiesPage /> },
      { path: 'timeline', element: <TimelinePage /> },
      { path: 'evidence', element: <EvidencePage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'trash', element: <TrashPage /> },
      { path: 'archive', element: <ArchivePage /> },
      { path: 'templates', element: <TemplateLibraryPage /> },
      { path: 'templates/new', element: <TemplateEditor /> },
      { path: 'game/:gameId', element: <NewBoardPage /> },
      { path: 'games/new', element: <GameCreatePage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}


