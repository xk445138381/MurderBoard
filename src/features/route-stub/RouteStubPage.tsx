import { EmptyState } from '../../shared/state';

interface RouteStubPageProps {
  title: string;
  message: string;
}

export function RouteStubPage({ title, message }: RouteStubPageProps) {
  return (
    <section aria-labelledby={`${title.toLowerCase()}-title`}>
      <h1 id={`${title.toLowerCase()}-title`}>{title}</h1>
      <EmptyState title={`${title} workspace`} message={message} />
    </section>
  );
}
