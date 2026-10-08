"use client";

import { Steps } from "@intentface/chat/steps";
import { Check, ChevronDown, Circle } from "@keyline-icons/react";

// Steps is recursive: an item's panel can hold rows and further items. A nested
// panel picks up data-nested, which is how the rail indent is drawn.
//
// Two disclosure idioms, both keyed off group-data-open/steps-trigger: the
// timeline header carries a chevron on the right, while a row's status icon
// morphs into a chevron, so a row gains an affordance without gaining a second
// glyph. The morph triggers on focus-visible as well as hover — otherwise a
// keyboard user tabbing onto a closed row gets no hint that it expands.
//
// The panels animate their height from --panel-height (see PANEL_CLASS). Collapse
// and expand the timeline to see it; expand "Searched the web" while the timeline
// is already open to see the outer panel grow to fit, rather than clipping. A rail
// joins the step icons (RAIL_CLASS).
//
// The question above and the half-written reply below are only context: the
// steps sit inside an assistant turn, the way they do in a chat.
export const Basic = () => (
  // Sized for the fully expanded state, so opening and closing steps never
  // shifts the page around the demo.
  <div className="flex min-h-80 w-full max-w-xl flex-col gap-4">
    <p className="max-w-[80%] self-end rounded-[20px] bg-white px-3.5 py-1.5 text-sm text-zinc-900 leading-6 shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04)] dark:bg-zinc-800 dark:text-zinc-100 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05),inset_0_0_0_1px_rgb(255_255_255/0.06),0_0_0_1px_rgb(0_0_0/0.16)]">
      What changed about refs in React 19?
    </p>
    <Steps.Root className="w-full">
      <Steps.Item defaultOpen>
        <Steps.Trigger className={`${TRIGGER_CLASS} font-medium`}>
          <span>Worked for 3 seconds</span>
          <ChevronDown className="size-[15px] shrink-0 -rotate-90 transition-transform group-data-open/steps-trigger:rotate-0" />
        </Steps.Trigger>

        <Steps.Panel className={PANEL_CLASS}>
          {/* Each step is a column: a piece of rail, then icon and label in a row.
              The first step has nothing above it to connect to. */}
          <div className="flex h-7 items-center gap-2.5">
            <Steps.Icon className={ICON_CLASS}>
              <Check className="size-[15px]" />
            </Steps.Icon>
            <Steps.Label className={LABEL_CLASS}>Read the request</Steps.Label>
          </div>

          {/* Closed by default, so opening it grows the settled outer panel. */}
          <Steps.Item>
            <span aria-hidden="true" className={RAIL_CLASS} />
            <Steps.Trigger className={TRIGGER_CLASS}>
              <Steps.Icon className={`relative ${ICON_CLASS}`}>
                <span className="transition-opacity group-hover/steps-trigger:opacity-0 group-focus-visible/steps-trigger:opacity-0 group-data-open/steps-trigger:opacity-0">
                  <Check className="size-[15px]" />
                </span>
                <ChevronDown className="absolute size-[15px] opacity-0 transition-all group-hover/steps-trigger:opacity-100 group-focus-visible/steps-trigger:opacity-100 group-data-open/steps-trigger:rotate-180 group-data-open/steps-trigger:opacity-100" />
              </Steps.Icon>
              <Steps.Label className={LABEL_CLASS}>Searched the web</Steps.Label>
            </Steps.Trigger>
            <Steps.Panel className={PANEL_CLASS}>
              <span className="py-1.5 text-[13px] text-zinc-500 leading-5 dark:text-zinc-400">
                Found three relevant sources and skimmed each. This detail is what the outer panel
                has to make room for.
              </span>
            </Steps.Panel>
          </Steps.Item>

          <div className="flex flex-col">
            <span aria-hidden="true" className={RAIL_CLASS} />
            <div className="flex h-7 items-center gap-2.5">
              <Steps.Icon status="active" className={ICON_CLASS}>
                <Circle className="size-[15px] animate-pulse" />
              </Steps.Icon>
              <Steps.Label status="active" className={LABEL_CLASS}>
                Writing the answer
              </Steps.Label>
            </div>
          </div>
        </Steps.Panel>
      </Steps.Item>
    </Steps.Root>
    <p className="text-sm text-zinc-700 leading-6 dark:text-zinc-300">
      Function components now take <code className="font-mono text-[13px]">ref</code> as a plain
      prop, so most <code className="font-mono text-[13px]">forwardRef</code> wrappers can go. Ref
      callbacks can also return a cleanup function
      <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-500" />
    </p>
  </div>
);

// The group name children read open state through — `steps-trigger` is the name
// the styled layer uses, so these classes port between the two unchanged.
const TRIGGER_CLASS =
  "group/steps-trigger flex h-7 w-full cursor-pointer items-center gap-2.5 rounded-md text-[13px] text-zinc-500 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0169cc]/60 dark:text-zinc-400 dark:hover:text-zinc-100";

// Height animates from --panel-height, which the panel publishes while a
// transition runs and releases once open — so this both animates the open/close
// and lets an open panel grow with its content. The data-starting/ending-style
// variants clamp it to 0 on the transitional frames and outrank the base height,
// since a data-attribute variant is more specific.
//
// [&>*]:shrink-0 guards the measurement: a flex column clamped to height 0 puts
// every child under shrink pressure, and a child collapsing to nothing would make
// the panel measure itself as 0px.
const PANEL_CLASS =
  "flex flex-col overflow-hidden h-(--panel-height) transition-[height] duration-200 ease-out data-starting-style:h-0 data-ending-style:h-0 [&>*]:shrink-0 in-data-nested:ml-[7px] in-data-nested:border-l in-data-nested:border-zinc-950/10 in-data-nested:pl-[17px] dark:in-data-nested:border-white/10";

// A piece of rail above a step, centred on the 15px icon column. An open nested
// panel draws the same line down its left edge, so the rail stays unbroken.
const RAIL_CLASS = "ml-[7px] block h-2 w-px bg-zinc-950/10 dark:bg-white/10";

// Status is inherited from the enclosing item and surfaced as data-status, so
// one class string covers every state.
const ICON_CLASS =
  "flex size-[15px] shrink-0 items-center justify-center data-[status=complete]:text-zinc-500 data-[status=active]:text-zinc-900 data-[status=pending]:text-zinc-400 dark:data-[status=complete]:text-zinc-400 dark:data-[status=active]:text-zinc-100 dark:data-[status=pending]:text-zinc-500";

const LABEL_CLASS =
  "text-left text-[13px] data-[status=complete]:text-zinc-700 data-[status=active]:font-medium data-[status=active]:text-zinc-900 data-[status=pending]:text-zinc-400 dark:data-[status=complete]:text-zinc-300 dark:data-[status=active]:text-zinc-100 dark:data-[status=pending]:text-zinc-500";
