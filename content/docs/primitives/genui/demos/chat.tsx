"use client";

import { type BoundData, defaultCatalog, genUiTool, isBinding } from "@intentface/chat/genui";
import { GenUi } from "@intentface/chat/genui-render";
import { Message } from "@intentface/chat/message";
import { parsePartialJson } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { components } from "./components";
import { formatJson } from "./format-json";
import {
  BarButton,
  Caret,
  CodeSection,
  CodeSide,
  CodeTabs,
  DrawnPane,
  Json,
  SplitWindow,
  ToolChip,
  UserBubble,
} from "./frame";

/*
 * One turn of a chat, played back. The person asks a question. The agent runs
 * its own data tool, `query_deals`. Then the model answers with UI: it calls
 * `show_ui`, and the chat draws the call as it streams in. On the right is
 * what the model actually wrote.
 *
 * - The table's rows aren't copied into the call. The query's result carries
 *   a ref, and the table names it: `"$data": "deals_1"`. The chat already
 *   holds that result, so it swaps the rows in (`resolve`, below).
 * - Once the call is whole, it is checked (`accept`). Accepted, it stays on
 *   screen and the model is told what was shown. Refused, the model is told
 *   what to fix and calls again: play it with a mistake.
 *
 * `accept` runs on your server, in the tool's `execute`. It runs here, in the
 * browser, only to stand in for one.
 */

const showUi = genUiTool(defaultCatalog, { name: "show_ui", kind: "spec" });

// What the agent's data tool returned earlier in the turn. The ref is yours to
// make up: anything short the model can copy back.
const QUERY = {
  ref: "deals_1",
  count: 4,
  total: 196000,
  rows: [
    { company: "Aalto Labs", stage: "Proposal", amount: 62400 },
    { company: "Kide Oy", stage: "Negotiation", amount: 48000 },
    { company: "Saari Systems", stage: "Negotiation", amount: 54100 },
    { company: "Nordvik", stage: "Proposal", amount: 31500 },
  ],
};

const RESULTS: Record<string, typeof QUERY> = { [QUERY.ref]: QUERY };

// The show_ui call: a card holding two numbers from the result and a table
// bound to its rows. The mistake is a child id that names no element.
const call = (deals: string) => ({
  root: "card",
  elements: [
    { id: "card", type: "Card", props: { title: "Pipeline" }, children: ["kpis", deals] },
    { id: "kpis", type: "Grid", props: { columns: 2 }, children: ["total", "count"] },
    {
      id: "total",
      type: "Metric",
      props: { label: "Total", value: QUERY.total, format: "currency", currency: "EUR" },
    },
    { id: "count", type: "Metric", props: { label: "Deals", value: QUERY.count } },
    {
      id: "deals",
      type: "DataTable",
      props: {
        columns: [
          { label: "Company" },
          { label: "Stage" },
          { label: "Amount", format: "currency", currency: "EUR" },
        ],
        rows: { $data: QUERY.ref, columns: ["company", "stage", "amount"] },
      },
    },
  ],
});

/**
 * Your chat's half of a binding: find the result its ref names, pick the
 * columns it lists, and file the rows by where the binding sits. Run on a
 * whole call; while it streams, a bound table is simply pending.
 */
const resolve = (input: unknown): BoundData => {
  const data: Record<string, unknown> = {};
  const { elements } = input as { elements: { id: string; props: { rows?: unknown } }[] };
  for (const element of elements) {
    const rows = element.props.rows;
    if (!isBinding(rows) || !Array.isArray(rows.columns)) continue;
    const result = RESULTS[rows.$data];
    if (!result) continue;
    const columns = rows.columns.map(String);
    data[`elements.${element.id}.props.rows`] = result.rows.map((row) =>
      columns.map((column) => row[column as keyof typeof row] ?? null),
    );
  }
  return data;
};

const RIGHT = formatJson(call("deals"), 36);
const WRONG = formatJson(call("deal"), 36);
const QUERY_TEXT = formatJson(QUERY, 36);

// The turn's two messages, as a chat holds them.
const ASK = { role: "user", text: "How’s our open pipeline this week?" };
const ANSWER = {
  role: "assistant",
  text: "Kide Oy and Saari Systems are both in negotiation, and together they make up just over half of the total.",
};
const REPLY = ANSWER.text.split(" ");

type Stage = "querying" | "streaming" | "checking" | "accepted" | "refused" | "replying" | "done";

const Turn = ({ mistake }: { mistake: boolean }) => {
  const [stage, setStage] = useState<Stage>("querying");
  const [attempt, setAttempt] = useState(1);
  const [length, setLength] = useState(0);
  const [words, setWords] = useState(0);
  const [partial, setPartial] = useState<unknown>();
  const [chosen, setChosen] = useState<"query" | "call">();
  const code = useRef<HTMLDivElement>(null);
  const chat = useRef<HTMLDivElement>(null);

  const source = mistake && attempt === 1 ? WRONG : RIGHT;
  const written = source.slice(0, length);
  const whole = useMemo(() => JSON.parse(source) as unknown, [source]);
  const streaming = stage === "streaming";
  // The call being written, unless you picked a tab yourself.
  const tab = chosen ?? (stage === "querying" ? "query" : "call");
  const data = useMemo(() => (streaming ? undefined : resolve(whole)), [streaming, whole]);
  const verdict = useMemo(() => showUi.accept(whole, { data: resolve(whole) }), [whole]);

  // The timeline: query, stream the call, check it, then reply.
  useEffect(() => {
    const after = (ms: number, next: () => void) => {
      const timer = setTimeout(next, ms);
      return () => clearTimeout(timer);
    };
    switch (stage) {
      case "querying":
        return after(900, () => setStage("streaming"));
      case "streaming":
        return length < source.length
          ? after(30, () => setLength((current) => current + 7))
          : after(60, () => setStage("checking"));
      case "checking":
        return after(700, () => setStage(verdict.ok ? "accepted" : "refused"));
      case "refused":
        return after(3200, () => {
          setAttempt(2);
          setLength(0);
          setPartial(undefined);
          setStage("streaming");
        });
      case "accepted":
        return after(400, () => setStage("replying"));
      case "replying":
        return words < REPLY.length
          ? after(45, () => setWords((current) => current + 1))
          : after(0, () => setStage("done"));
      default:
        return undefined;
    }
  }, [stage, length, source.length, words, verdict.ok]);

  // What the AI SDK hands a chat while a call streams: the text so far, parsed.
  useEffect(() => {
    if (!streaming) return;
    let current = true;
    parsePartialJson(written).then(({ value }) => {
      if (current) setPartial(value);
    });
    return () => {
      current = false;
    };
  }, [streaming, written]);

  // Keep the newest line of the call in view while it is written, and the
  // mistake in view once it is refused.
  useEffect(() => {
    const pane = code.current;
    if (!pane || tab !== "call") return;
    const mistake = pane.querySelector<HTMLElement>("[data-mark]");
    if (stage === "refused" && mistake) pane.scrollTop = mistake.offsetTop - pane.clientHeight / 3;
    else if (streaming && written) pane.scrollTop = pane.scrollHeight;
  }, [stage, streaming, written, tab]);

  // And the newest part of the reply, as a chat does: follow it as it grows.
  useEffect(() => {
    const pane = chat.current;
    const content = pane?.firstElementChild;
    if (!pane || !content) return;
    const observer = new ResizeObserver(() => {
      pane.scrollTop = pane.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  const phase = streaming
    ? "streaming"
    : stage === "checking" || stage === "refused"
      ? "complete"
      : "accepted";
  const status =
    stage === "refused" ? (
      <span className="text-red-300">refused</span>
    ) : phase === "accepted" ? (
      <span className="text-emerald-300">accepted</span>
    ) : streaming ? (
      "streaming"
    ) : (
      "checking"
    );

  const back =
    stage === "accepted" || stage === "refused" || stage === "replying" || stage === "done"
      ? showUi.modelText(verdict)
      : stage === "checking"
        ? "Checking the call…"
        : "Nothing yet: the call isn’t whole.";

  return (
    <>
      <DrawnPane ref={chat} title="Chat">
        <div className="flex flex-col gap-4">
          <Message.Root className="flex flex-col" role={ASK.role}>
            <UserBubble>{ASK.text}</UserBubble>
          </Message.Root>
          <Message.Root className="flex flex-col gap-3" isLast role={ANSWER.role}>
            <ToolChip
              detail={stage === "querying" ? undefined : `${QUERY.count} rows`}
              done={stage !== "querying"}
              name="query_deals"
            />
            {stage === "querying" ? null : (
              <div className={`transition-opacity ${stage === "refused" ? "opacity-40" : ""}`}>
                <GenUi.Root components={components} key={attempt} live phase={phase}>
                  <GenUi.Spec data={data} input={streaming ? partial : whole} />
                </GenUi.Root>
              </div>
            )}
            {stage === "refused" ? (
              <p className="text-ink-tertiary text-sm">Refused. The model is calling again…</p>
            ) : null}
            {words > 0 ? (
              <p className="text-ink-body text-md leading-6">{REPLY.slice(0, words).join(" ")}</p>
            ) : null}
          </Message.Root>
        </div>
      </DrawnPane>

      <CodeSide
        footer={
          <>
            <div className="mb-1 font-medium font-sans text-white/50">Back to the model</div>
            <p className="whitespace-pre-wrap">{back}</p>
          </>
        }
      >
        <CodeSection
          header={
            <CodeTabs
              label="Tool calls"
              onChange={setChosen}
              options={[
                { value: "query", label: "query_deals" },
                { value: "call", label: "show_ui" },
              ]}
              value={tab}
            />
          }
          ref={code}
          status={
            tab === "query" ? (
              stage === "querying" ? (
                "running"
              ) : (
                "returned"
              )
            ) : stage === "querying" ? null : (
              <>
                {attempt === 2 ? "attempt 2 · " : null}
                {status}
              </>
            )
          }
        >
          {tab === "query" ? (
            <Json accent={`"${QUERY.ref}"`} text={QUERY_TEXT} />
          ) : stage === "querying" ? (
            <span className="text-white/40">Not called yet.</span>
          ) : (
            <>
              <Json
                accent={`"${QUERY.ref}"`}
                mark={stage === "refused" ? '"deal"' : undefined}
                text={written}
              />
              {streaming ? <Caret /> : null}
            </>
          )}
        </CodeSection>
      </CodeSide>
    </>
  );
};

export const Chat = () => {
  // A new key is a new turn, played from the start.
  const [run, setRun] = useState({ id: 0, mistake: false });
  const play = (mistake: boolean) => setRun((current) => ({ id: current.id + 1, mistake }));
  return (
    <SplitWindow
      bar={
        <>
          <BarButton onClick={() => play(false)}>Play again</BarButton>
          <BarButton onClick={() => play(true)}>Play with a mistake</BarButton>
        </>
      }
      columns="sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
      height="sm:h-152"
    >
      <Turn key={run.id} mistake={run.mistake} />
    </SplitWindow>
  );
};
