import Link from "next/link";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </div>
  );
}

export function Button({ children, href, variant = "primary", type = "button", disabled, onClick }: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "quiet" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className = `button button-${variant}`;
  if (href) return <Link className={className} href={href}>{children}</Link>;
  return <button className={className} type={type} disabled={disabled} onClick={onClick}>{children}</button>;
}

export function ConfigNotice() {
  return (
    <div className="config-notice" role="status">
      <span className="status-dot" aria-hidden="true" />
      <div>
        <strong>MatchClaim contract is not configured</strong>
        <p>Add the public GenLayer settings in <code>frontend/.env.local</code> before using live reads or writes.</p>
      </div>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">—</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return message ? <p className="form-error" role="alert">{message}</p> : null;
}

export function TechnicalDetails({ children }: { children: ReactNode }) {
  return <details className="technical-details"><summary>Technical details</summary><div>{children}</div></details>;
}

export function DataRow({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return <div className="data-row"><dt>{label}</dt><dd className={mono ? "mono" : ""}>{value}</dd></div>;
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor: string; hint?: string }) {
  return <label className="field-label" htmlFor={htmlFor}>{children}{hint ? <span>{hint}</span> : null}</label>;
}

export function LoadingBlock({ label = "Reading the contract…" }: { label?: string }) {
  return <div className="loading-block"><span className="spinner" aria-hidden="true" />{label}</div>;
}
