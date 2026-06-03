import { useRouteError } from 'react-router-dom';
import { ErrorState } from '../../shared/state';

export function RouteError() {
  const error = useRouteError();
  const message =
    error instanceof Error
      ? error.message
      : 'The requested MurderBoard route could not be loaded.';

  return <ErrorState title="Route unavailable" message={message} />;
}
