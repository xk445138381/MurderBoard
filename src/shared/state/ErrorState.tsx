interface ErrorStateProps {
  title: string;
  message: string;
}

export function ErrorState({ title, message }: ErrorStateProps) {
  return (
    <section role="alert" className="state-card state-card--error">
      <h2>{title}</h2>
      <p>{message}</p>
    </section>
  );
}
