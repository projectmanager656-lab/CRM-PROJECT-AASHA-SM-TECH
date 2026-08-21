export default function PageHeader({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="page-header-row">
      <div>
        <p className="section-kicker">Overview</p>
        <h2>{title}</h2>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {actionLabel ? (
        <button type="button" className="page-header-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
