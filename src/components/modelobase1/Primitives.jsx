export function ModeloBase1ActionBar({ children, end, className = "", ...props }) {
  return (
    <div className={`mb1-action-bar ${className}`.trim()} {...props}>
      <div className="mb1-action-cluster">{children}</div>
      {end ? <div className="mb1-action-cluster mb1-action-cluster--end">{end}</div> : null}
    </div>
  );
}
