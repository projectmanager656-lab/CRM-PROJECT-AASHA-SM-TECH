export default function ChartCard({ title, actionText, children }) {
  return (
    <section className="chart-card">
      <div className="chart-header">
        <h3>{title}</h3>
        {actionText ? <button type="button">{actionText}</button> : null}
      </div>
      {children}
    </section>
  );
}
