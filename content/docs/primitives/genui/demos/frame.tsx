"use client";

import { Check } from "@keyline-icons/react";
import type { ReactNode, Ref } from "react";

/*
 * Demo chrome, not part of generative UI: the code panes, the JSON colouring,
 * the chat bubbles and the switches these demos are laid out with.
 */

// The docs' code theme: blue keys, green strings, amber numbers.
const TOKEN = /("(?:[^"\\]|\\.)*"?)(\s*:)?|(-?\d+(?:\.\d+)?|true|false|null)|([{}[\],])/g;
const KEY = "text-[#9cc2f5]";
const STRING = "text-[#a6d7b8]";
const LITERAL = "text-[#f0c38e]";
const PUNCTUATION = "text-[#71717a]";
const ACCENT = "rounded-xs bg-[#9cc2f5]/20 text-[#d6e6fc]";
const MARK = "rounded-xs bg-red-500/30 text-[#ffc9c0] underline decoration-red-400 decoration-wavy";

/**
 * JSON text, coloured. `accent` picks out one string wherever it appears (a
 * ref and the binding that names it); `mark` flags one as the mistake.
 */
export const Json = ({ text, accent, mark }: { text: string; accent?: string; mark?: string }) => {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of text.matchAll(TOKEN)) {
    const [whole, string, colon, literal, punctuation] = match;
    if (match.index > last) out.push(text.slice(last, match.index));
    if (string !== undefined && colon) {
      out.push(
        <span className={KEY} key={key++}>
          {string}
        </span>,
        <span className={PUNCTUATION} key={key++}>
          {colon}
        </span>,
      );
    } else if (string !== undefined) {
      const style = string === mark ? MARK : string === accent ? ACCENT : STRING;
      out.push(
        <span className={style} data-mark={string === mark ? "" : undefined} key={key++}>
          {string}
        </span>,
      );
    } else {
      out.push(
        <span className={literal !== undefined ? LITERAL : PUNCTUATION} key={key++}>
          {literal ?? punctuation}
        </span>,
      );
    }
    last = match.index + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
};

// ---------------------------------------------------------------------------
// The split window every demo sits in: the result drawn on the left, the
// JSON on the right, a bar on top for what you can choose.
// ---------------------------------------------------------------------------

const HIDDEN_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * One window, split in two. Each pane scrolls inside it, so it never jumps.
 * The bar leaves its right end clear for the docs' replay button.
 */
export const SplitWindow = ({
  bar,
  height,
  columns = "sm:grid-cols-2",
  children,
}: {
  /** Pickers and buttons, top left. */
  bar?: ReactNode;
  /** The window's height from `sm` up, e.g. "sm:h-120". */
  height: string;
  /** How the two panes share the width from `sm` up. Even by default. */
  columns?: string;
  children: ReactNode;
}) => (
  // Drawn edge to edge in the docs' preview card, which is its frame.
  <div className={`flex w-full flex-col ${height}`}>
    {bar ? (
      <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-1 border-ink-primary/6 border-b py-2 pr-12 pl-2">
        {bar}
      </div>
    ) : null}
    <div className={`grid min-h-0 flex-1 sm:grid-rows-[minmax(0,1fr)] ${columns}`}>{children}</div>
  </div>
);

/** The light half: where the result is drawn. */
export const DrawnPane = ({
  title,
  actions,
  ref,
  children,
}: {
  title: ReactNode;
  actions?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) => (
  <section className="flex h-104 min-h-0 min-w-0 flex-col sm:h-auto">
    <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-ink-primary/6 border-b px-4">
      <span className="font-medium text-ink-secondary text-xs">{title}</span>
      {actions}
    </header>
    <div
      className={`scroll-mask-y relative min-h-0 flex-1 overflow-y-auto p-5 ${HIDDEN_SCROLLBAR}`}
      ref={ref}
    >
      {children}
    </div>
  </section>
);

/** The dark half: one or more code sections, and an optional footer. */
export const CodeSide = ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
  <section className="flex h-96 min-h-0 min-w-0 flex-col bg-code-bg sm:h-auto">
    {children}
    {footer ? (
      <footer className="shrink-0 border-white/8 border-t px-4 py-3 font-mono text-2xs text-[#d4d4d8] leading-[1.65]">
        {footer}
      </footer>
    ) : null}
  </section>
);

/** A code section: a header (a title or tabs, and a status) over scrolling code. */
export const CodeSection = ({
  header,
  status,
  ref,
  children,
}: {
  header: ReactNode;
  status?: ReactNode;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}) => (
  <div className="flex min-h-0 flex-1 flex-col [&+&]:border-white/8 [&+&]:border-t">
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-white/8 border-b pr-4 pl-2">
      <div className="flex h-full min-w-0 items-center">{header}</div>
      {status ? <span className="shrink-0 text-2xs text-white/56">{status}</span> : null}
    </div>
    <div
      className={`scroll-mask-y relative min-h-0 flex-1 overflow-y-auto ${HIDDEN_SCROLLBAR}`}
      ref={ref}
    >
      <pre className="whitespace-pre-wrap wrap-break-word p-4 font-mono text-2xs text-[#d4d4d8] leading-[1.65]">
        {children}
      </pre>
    </div>
  </div>
);

/** A code header's title, as the docs' code blocks label a file. */
export const CodeTitle = ({ children }: { children: ReactNode }) => (
  <span className="px-2 font-medium font-mono text-white/92 text-xs">{children}</span>
);

/** Code header tabs, styled like the docs' code-block tabs. */
export const CodeTabs = <Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) => (
  <div aria-label={label} className="flex h-full items-center" role="tablist">
    {options.map((option) => (
      <button
        aria-selected={value === option.value}
        className={`relative flex h-full cursor-pointer items-center px-2 font-medium font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-white/60 focus-visible:-outline-offset-2 ${
          value === option.value
            ? "text-white/92 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-t-full after:bg-white/92"
            : "text-white/50 hover:text-white/80"
        }`}
        key={option.value}
        onClick={() => onChange(option.value)}
        role="tab"
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
);

/** Where the model is still writing. */
export const Caret = () => (
  <span className="ml-px inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-white/70" />
);

/** The person's message, as the playground draws it. */
export const UserBubble = ({ children }: { children: ReactNode }) => (
  <div className="max-w-[85%] self-end rounded-[20px] bg-composer-bg px-3.5 py-1.5 text-ink-primary text-md leading-6 shadow-card">
    {children}
  </div>
);

/** A tool the agent ran, as a chip in its reply. */
export const ToolChip = ({
  name,
  detail,
  done,
}: {
  name: string;
  detail?: string;
  done: boolean;
}) => (
  <span className="inline-flex h-6 items-center gap-1.5 self-start rounded-full bg-raised pr-2.5 pl-1.5 font-medium text-ink-body text-xs shadow-raised">
    {done ? (
      <Check className="size-3.5 text-ink-secondary" />
    ) : (
      <span className="size-3 animate-spin rounded-full border-[1.5px] border-ink-tertiary border-t-transparent" />
    )}
    <span className="font-mono">{name}</span>
    {detail ? <span className="text-ink-tertiary">{detail}</span> : null}
  </span>
);

/** A two- or three-way switch, styled like the docs' Preview / Code tabs. */
export const Switch = <Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) => (
  <div aria-label={label} className="flex flex-wrap items-center gap-0.5" role="group">
    {options.map((option) => (
      <button
        aria-pressed={value === option.value}
        className={`h-6 cursor-pointer rounded-full px-2.5 font-medium text-xs transition-[color,background-color,box-shadow] focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2 ${
          value === option.value
            ? "bg-raised text-ink-primary shadow-raised"
            : "text-ink-secondary hover:text-ink-primary"
        }`}
        key={option.value}
        onClick={() => onChange(option.value)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
);

/** Markdown as text: what the UI reads as wherever it can't be drawn. */
export const MarkdownText = ({ markdown }: { markdown: string }) => (
  <pre className="whitespace-pre-wrap wrap-break-word font-mono text-2xs text-ink-body leading-[1.65]">
    {markdown}
  </pre>
);

/** A button in a window's bar. */
export const BarButton = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button
    className="h-6 cursor-pointer rounded-full px-2.5 font-medium text-ink-secondary text-xs transition-colors hover:bg-ink-primary/[0.04] hover:text-ink-primary focus-visible:outline-2 focus-visible:outline-accent-bg/60 focus-visible:outline-offset-2"
    onClick={onClick}
    type="button"
  >
    {children}
  </button>
);
