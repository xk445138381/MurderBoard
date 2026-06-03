interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <section aria-labelledby="empty-state-title" className="state-card">
      <h2 id="empty-state-title">{title}</h2>
      <p>{message}</p>
    </section>
  );
}
