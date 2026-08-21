export default function StatCard({ title, value, trend, tone = 'purple' }) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-topline">
        <span>{title}</span>
        <div className="stat-icon">↗</div>
      </div>
      <strong>{value}</strong>
      <small>{trend}</small>
    </article>
  );
}
