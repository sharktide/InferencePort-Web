"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Icon, { type IconName } from "../../Icon";
import shared from "./Playground.module.css";
import { displayName, slug } from "./models";
import { formatModelPrice } from "../../../lib/modelPricing";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ---------- Field wrapper ---------- */
export function Field({ label, hint, children, right }: { label: string; hint?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className={shared.field}>
      <div className={shared.fieldHead}>
        <span className={shared.label}>{label}</span>
        {right}
      </div>
      {children}
      {hint && <span className={shared.hint}>{hint}</span>}
    </div>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string | number>({
  value, onChange, options, size,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  size?: "sm";
}) {
  return (
    <div className={cx(shared.segmented, size === "sm" && shared.segSm)} role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          title={o.title}
          className={cx(shared.segBtn, value === o.value && shared.segActive)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Slider with readout ---------- */
export function Range({
  label, value, min, max, step = 1, onChange, format, hint,
}: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: (v: number) => string; hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <Field label={label} hint={hint} right={<span className={shared.readout}>{format ? format(value) : value}</span>}>
      <input
        type="range"
        className={shared.range}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ["--pct" as any]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}

/* ---------- Searchable model picker ---------- */
export function ModelSelect({
  models, value, onChange, defaultLabel, placeholder = "Select a model", label = "Model", hint,
}: {
  models: any[]; value: string; onChange: (v: string) => void;
  /** When set, adds a leading "no explicit model" option. */
  defaultLabel?: string; placeholder?: string; label?: string; hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const current = models.find((m) => slug(m) === value);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return models;
    return models.filter((m) => `${displayName(m)} ${slug(m)} ${m?.publisher_url || ""}`.toLowerCase().includes(s));
  }, [models, q]);

  const pick = (v: string) => { onChange(v); setOpen(false); setQ(""); };

  return (
    <Field label={label} hint={hint}>
      <div className={shared.picker} ref={root}>
        <button
          type="button"
          className={cx(shared.pickerBtn, open && shared.pickerOpen)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={shared.pickerText}>
            <span className={shared.pickerName}>{current ? displayName(current) : value ? value : defaultLabel || placeholder}</span>
            {current && formatModelPrice(current) && <span className={shared.pickerPrice}>{formatModelPrice(current)}</span>}
          </span>
          <Icon name="list" className={shared.pickerCaret} />
        </button>
        {open && (
          <div className={shared.pickerPop} id={listId} role="listbox">
            <input autoFocus className={shared.pickerSearch} placeholder="Search models…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className={shared.pickerList}>
              {defaultLabel && !q && (
                <button type="button" role="option" aria-selected={!value} className={cx(shared.pickerItem, !value && shared.pickerSel)} onClick={() => pick("")}>
                  <span className={shared.pickerName}>{defaultLabel}</span>
                </button>
              )}
              {shown.map((m) => (
                <button type="button" role="option" aria-selected={slug(m) === value} key={slug(m)} className={cx(shared.pickerItem, slug(m) === value && shared.pickerSel)} onClick={() => pick(slug(m))}>
                  <span className={shared.pickerName}>{displayName(m)}</span>
                  {formatModelPrice(m) && <span className={shared.pickerPrice}>{formatModelPrice(m)}</span>}
                </button>
              ))}
              {shown.length === 0 && <div className={shared.pickerEmpty}>No models match.</div>}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/* ---------- Status + errors ---------- */
export function StatusLine({ state, children }: { state: "pending" | "done" | "failed"; children: ReactNode }) {
  return (
    <div className={shared.status} role="status" aria-live="polite">
      <span className={cx(shared.dot, state === "pending" && shared.dotPending, state === "done" && shared.dotDone, state === "failed" && shared.dotFailed)} />
      <span>{children}</span>
    </div>
  );
}

export function ErrorNote({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  if (!children) return null;
  return (
    <div className={shared.errorNote} role="alert">
      <Icon name="warning-circle" />
      <span>{children}</span>
      {onDismiss && <button type="button" className={shared.errorX} onClick={onDismiss} aria-label="Dismiss"><Icon name="x" /></button>}
    </div>
  );
}

/* ---------- Buttons ---------- */
export function Button({
  variant = "primary", busy, icon, children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; busy?: boolean; icon?: IconName }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(shared.btn, variant === "primary" && shared.btnPrimary, variant === "ghost" && shared.btnGhost, variant === "danger" && shared.btnDanger, rest.className)}
    >
      {busy ? <span className={shared.btnSpin} aria-hidden="true" /> : icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon, label, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={cx(shared.iconBtn, rest.className)}>
      <Icon name={icon} />
    </button>
  );
}

/* ---------- File drop ---------- */
export function Dropzone({
  accept, onFile, file, previewUrl, hint = "Drop a file or click to browse", kind = "file",
}: {
  accept: string; onFile: (f: File | null) => void; file: File | null; previewUrl?: string; hint?: string; kind?: "image" | "audio" | "file";
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cx(shared.drop, over && shared.dropOver, file && shared.dropHas)}
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
    >
      <input ref={input} type="file" hidden accept={accept} onChange={(e) => onFile(e.target.files?.[0] || null)} />
      {file && kind === "image" && previewUrl ? (
        <img src={previewUrl} alt="" className={shared.dropThumb} />
      ) : (
        <Icon name={kind === "image" ? "eye" : "cube"} className={shared.dropIcon} />
      )}
      <div className={shared.dropText}>
        <span className={shared.dropTitle}>{file ? file.name : hint}</span>
        {file && <span className={shared.hint}>{(file.size / 1024 / 1024).toFixed(2)} MB · click to replace</span>}
      </div>
      {file && <IconButton icon="x" label="Remove file" onClick={(e) => { e.stopPropagation(); onFile(null); if (input.current) input.current.value = ""; }} />}
    </div>
  );
}

/* ---------- Empty stage ---------- */
export function EmptyStage({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className={shared.empty}>
      <div className={shared.emptyIcon}><Icon name={icon} size={28} /></div>
      <div className={shared.emptyTitle}>{title}</div>
      {children && <p className={shared.emptyText}>{children}</p>}
    </div>
  );
}

/* ---------- Advanced: collapsed-by-default disclosure for secondary settings ---------- */
export function Advanced({ children, label = "Advanced", defaultOpen = false }: { children: ReactNode; label?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cx(shared.advanced, open && shared.advancedOpen)}>
      <button type="button" className={shared.advancedHead} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <Icon name="plus" className={shared.advancedIcon} />
      </button>
      {open && <div className={shared.advancedBody} id={id}>{children}</div>}
    </div>
  );
}
