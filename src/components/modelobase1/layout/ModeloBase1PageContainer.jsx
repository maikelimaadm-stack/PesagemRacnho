import { forwardRef } from "react";

export const ModeloBase1PageContainer = forwardRef(function ModeloBase1PageContainer(
  { children, className = "", variant = "default", ...props },
  ref,
) {
  return (
    <main
      ref={ref}
      className={`mb1-operational-page mb1-operational-page--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </main>
  );
});

export function ModeloBase1PageHeader({ title, description, actions, className = "", visuallyHidden = false, ...props }) {
  return (
    <header
      className={`mb1-operational-page-header${visuallyHidden ? " mb1-operational-page-header--sr-only" : ""} ${className}`.trim()}
      {...props}
    >
      <div className="mb1-operational-page-header__copy">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="mb1-operational-page-header__actions">{actions}</div> : null}
    </header>
  );
}
