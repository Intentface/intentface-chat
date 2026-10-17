# Generative UI plan

**The roadmap for `@intentface/chat/genui`, `/genui-render` and `/genui-testing`.** What the entries do today is documented in [`content/docs/primitives/genui.mdx`](../content/docs/primitives/genui.mdx). This file covers where they are going and why.

**How this plan changes.** The decisions below are settled. Each step in [§12](#12-order-of-work) gets a short spec when it starts, as `plans/genui-<step>.md`, committed with that step's PR and reviewed there.

The plan extends generative UI in three ways:
- From a display catalog to one that can compose interactive answers.
- To stored apps: specs a host keeps and fills with parameters.
- To any team that wants to render generative UI with **its own components**.

---

## Summary

- **The format is JSON tool calls.** Typed end to end with zod, streamed as partial tool input, stored as plain versioned data.
- **The model writes data, never code.** Interactivity comes from a closed vocabulary, so nothing model-written ever runs.
- **Bring your own components:**
  - The package works out all the logic: state, the rows after search, filter, sort and paging, selection, formatting, validation and announcements.
  - It hands components **render props** ready to wire up. Components own markup, interaction and styling.
  - The docs ship copy-paste examples, and the package ships conformance checks.
- **A tool helper** gives any host the tool description, schema, examples, validation and model text, with no SDK in it.
- **Interactivity has four levels**, each shipped only when needed:
  - **L0, managed:** search, sort, paging, row expansion, tabs, disclosures, checklists.
  - **L1, state:** declared keys that inputs and row selection write, and other elements read.
  - **L2, expressions:** checked arithmetic for calculators. Deferred.
  - **L3, actions:** `copy`, `download`, `open`, `set`, and `run`. The confirmation for `run` is drawn from what will actually run.
- **The UI never speaks for the person.** The person types their own follow-ups, and a visible state line tells the model what they chose.
- **Catalog presets** narrow what the model is sent. Readers always read against the widest catalog.
- **An app is a stored spec with params.** Logic lives in the host's server-side code, so the UI language stays declarative.

---

## Roles

| Tag | Owner | Owns |
| --- | --- | --- |
| **[P]** | Package (`@intentface/chat`) | Schemas, presets, checks, state logic, derived rows, formatting, escaped Markdown, render contracts, fixtures, conformance checks, announcement messages, the tool helper |
| **[H]** | Host (the app embedding it) | Wrapping the tool helper for its SDK, resolving targets and links, persistence, sending the state line, `run` approval and execution, auth, audit, debouncing |
| **[C]** | Components (a design system) | Markup, styling, focus, keyboard, pointer, ARIA |

The package reads no thread, message or chat. Refs and params stay opaque to it. This repo builds the [P] parts. The [H] items say what a host must do for the [P] parts to hold.

---

## 1. Invariants

1. **The model writes data, never code.**
2. **Everything that can be wrong is checked at acceptance,** and refusals name the field. That includes `run` arguments.
3. **Undoable view transforms are fine on any data.** Filter, sort, search, page, tab, expand and select change what the reader sees, not what the numbers are.
4. **New numbers come only from the model's own state (L2) or from the query.** A binding only picks.
5. **Every element reads as Markdown in any state.** That Markdown is used wherever an element can't be drawn, and whenever it is copied.
6. **State lives beside the spec, never in it.** An accepted spec is immutable.
7. **The UI never speaks for the person.** No message is sent in their name.
8. **Nothing leaves the UI without an explicit action.** `run` confirms against the real tool and the resolved args.
9. **The model never writes a URL.** Links come only from resolved targets, on screen and in Markdown.
10. **Logic is the package's; interaction is the component's.**

---

## 2. Format, acceptance and the tool helper

### 2.1 Why JSON tool calls

| | JSON tool calls | Custom language | Markup with code |
| --- | --- | --- | --- |
| Typing | zod: the same schema is the model's docs, the server's check and the renderer's guard | Needs its own type layer | Props checked; logic unchecked |
| Streaming | Partial tool input; `readSpec` and `settle` | Own streaming parser | Recompile on every chunk |
| Feedback to the model | Refusal is the tool result; retries work | Needs a correction step | Logic errors fail silently |
| Infrastructure | None new | Parser and runtime | Compiler, sandbox, reconciler |
| Output tokens | Highest | Roughly half | Low |

Three things narrow the token cost:
- `$data` bindings. A bound 24-row table measured about 200 output tokens.
- Rows as arrays.
- Presets.

### 2.2 Phase (shipped)

`GenUi.Root` takes `phase: "streaming" | "complete" | "accepted"`, defaulting to `"accepted"`:
- `complete` means the tool input is whole.
- `accepted` means it has passed `canonicalSpec` or `canonicalView`.

A whole input can still be refused, and while a refused call waits for its retry, it stays on screen. As interactive elements arrive, phase gates them:

| | `streaming` | `complete` | `accepted` |
| --- | --- | --- | --- |
| Tabs, disclosures | Live | Live | Live |
| Sort, search, page, expand | Off (rows would reorder under the pointer) | Live | Live |
| L1 inputs and selection | Disabled | Disabled | Live |
| L3 actions | Disabled | Disabled | Live |

L1 inputs wait for acceptance because a refused call is replaced by its retry, and anything the person set on it would be lost. Components receive this as `disabled` in their render props.

### 2.3 Acceptance and streaming [P]

- **`canonicalSpec` and `canonicalView` are the only acceptance paths.** A host's tool `execute` calls one of them, or the tool helper's `accept`.
- **Key order guides writing order.** The order of keys in the schema guides the order the model writes in: `state` comes before `elements`, as `view` comes before `props`.
- **Anything keyed is sent as a list,** because tool-schema converters erase `z.record` value schemas.
- **A missing state key means Pending.** An element whose `$state` key hasn't arrived yet renders in the `Pending` slot. It is never read as `null`, because `null` means something: a `null` filter matches everything.
- **Undeclared state keys are refused at acceptance.**

### 2.4 Tool helper [P] (shipped)

`genUiTool(catalog, { name, kind, views?, examples?, limits? })` gives a host:
- `description`
- `inputSchema`, always an object at the top level
- `examples`
- `accept(input, { data })`, returning the spec or view and a summary
- `modelText(result)`
- `toMarkdown(input, options)`

`compactHistory` replaces earlier large UI inputs with what they showed. The schema is **shown to the model but not enforced by the SDK**: `accept` validates, so refusals name the field.

The helper is cached per catalog and options, so a host's definition, and its prompt cache, change only when those do. L3 adds `runnable`: the tools a UI may run, with their input schemas ([§7.2](#72-run-p-h)). Once that varies per agent, the layout tool is per agent too.

### 2.5 In chat, UI is always a tool call

- The model shows UI in a chat only by calling the UI tools. It never writes a spec into its reply text, fenced or not. The tool helper's description says so.
- Only a tool call gets the schema as documentation, acceptance, and the refusal loop back to the model.
- Fenced specs exist only in documents, where the host checks them when the document is saved ([§10.1](#101-views-inside-documents)).

---

## 3. Levels of interactivity

| Level | What it is | Spec change | Example |
| --- | --- | --- | --- |
| **L0 Managed** | Behaviour inside one element; the package works out the state, the component draws it | Props only | Search and sort a table, switch tabs, expand a row, tick a checklist |
| **L1 State** | Declared keys that inputs and row selection write, and elements read | `state`, `$state`, `when`, `select` | Stage chips filter the deals table; a toggle shows a section |
| **L2 Expressions** | Derived values from state, closed grammar | `$expr` in a whitelist of value props | Guest count into quantities |
| **L3 Actions** | Effects outside the UI | `action` on `Button`; `Form` for `run` | Copy a list; download CSV; run an update after confirmation |

---

## 4. Rendering contract

### 4.1 Schema props are not render props (shipped)

- **Schema props** are shaped for the model: rows as arrays, raw numbers, no handlers.
- **Render props** are shaped for components: formatted text, the current state and callbacks.

Conventions follow the rest of the package:
- **Values:** `value` / `defaultValue` / `onValueChange(value, details)`. `details` are the package's change-event details (`reason`, `event`, `trigger`, `cancel()`), so a host can refuse a change.
- **`disabled`** comes from [§2.2](#22-phase-shipped).
- **`props`:** every component also gets the raw parsed schema props.
- **Custom elements** shape their own render props with an optional pure `toRender(props, context)`, which keeps the core free of React.

### 4.2 Contracts [P]

The shipped contracts are typed in [`packages/chat/src/genui/render.ts`](../packages/chat/src/genui/render.ts) (`Metric`, `KeyValue`, `DataTable`, `Chart`, and the `metrics`, `record` and `steps` views). The planned ones below are indicative.

```ts
type InputRender<V> = {
  label: string;
  value: V;
  onValueChange(value: V, details: ChangeEventDetails): void;
  disabled: boolean;
  name?: string; // set inside a Form
};

type ChoiceRender = InputRender<string | null | string[]> & {
  options: { value: string | null; label: string }[];
  display: "chips" | "segmented" | "select" | "radio";
  multiple: boolean;
};
type NumberInputRender = InputRender<number> & {
  min: number; max: number; step: number;
  display: "stepper" | "slider" | "field";
  text: string; unit?: string;
};
type ToggleRender = InputRender<boolean>;
type TextInputRender = InputRender<string> & { placeholder?: string; multiline: boolean; maxLength: number };
type DateInputRender = InputRender<string | null> & { min?: string; max?: string };

// What L0 and L1 add to the shipped DataTableRender. `display`, `sortable` and
// DisplayCell.href are already typed and get their values here.
type DataTableAdditions = {
  search?: { value: string; onValueChange(v: string, d: ChangeEventDetails): void };
  sort: { column?: string; direction: "asc" | "desc"; onSortChange(column: string): void };
  page?: { index: number; count: number; onPageChange(i: number): void };
  selection?: { value: string | null; onValueChange(key: string | null, d: ChangeEventDetails): void; disabled: boolean };
  expansion?: { isExpanded(key: string): boolean; onToggle(key: string): void; fields(key: string): { label: string; text: string }[] };
};

type ListItem = { key: string; title: string; subtitle?: string; meta: string[]; badge?: { label: string; tone: Tone }; image?: { src: string; alt: string } };
type ListRender = { items: ListItem[]; groups?: { label: string; items: ListItem[] }[]; count: { total: number; matching: number }; search?; sort?; selection? };
type BoardRender = { lanes: { id: string; label: string; items: ListItem[] }[]; selection? };
type TimelineRender = { items: { key: string; date: DisplayCell; title: string; detail?: string; tone?: Tone }[] };

type TabsRender = { tabs: { id: string; label: string; badge?: string }[]; value: string; onValueChange(id: string, d: ChangeEventDetails): void; panel(id: string): ReactNode };
type DisclosureRender = { title: string; open: boolean; onOpenChange(open: boolean, d: ChangeEventDetails): void; children: ReactNode };
type ChecklistRender = { items: { key: string; title: string; detail?: string; status: "todo" | "current" | "done" }[]; onToggle?(key: string): void };

type ProgressRender = { label: string; text: string; ratio: number };
type ImageRender = { src: string; alt: string; aspect: Aspect }; // not drawn if the target didn't resolve

type ButtonRender = { label: string; tone: "primary" | "secondary" | "danger"; disabled: boolean; pending: boolean; onClick(): void };
type FormRender = { children: ReactNode; submitLabel: string; disabled: boolean; pending: boolean; onSubmit(): void };
```

- **Row keys** are the `rowKey` value, or the source index when there is no `rowKey`, so expanded rows stay expanded after sorting.
- **Layout and plain content** (`Card`, `Stack`, `Grid`, `Split`, `Divider`, `Heading`, `Text`, `Callout`, `Badge`, `Code`) keep their schema props, plus `children`.
- **`Tab`** has no component of its own: `Tabs` draws the panels.
- **`onAction` returns a promise,** so `pending` has something to wait on.

### 4.3 Three ways to adopt, freely mixed

1. **Map your own components** (the main path). A few lines per element; `defineComponents` checks the map against the catalog.
2. **Copy-paste examples from the docs.** Each element's docs page has a working example:
   - Native elements wherever they're already accessible: `<select>`, `<input type="range">`, `type="number"`, a checkbox with `role="switch"`, `type="date"`, `<details>`.
   - Bespoke markup only for `Tabs` and chip or segmented `Choice`.
   - The package itself ships no styled or unstyled parts.
3. **Raw.** Ignore the render props and use `props`, for example with your own data grid. You then own that element's behaviour. Selection still flows back through `useGenUiState(key)`.

An element with no component is drawn through the `Fallback` slot from its Markdown (invariant 5). That's shipped.

### 4.4 Catalog presets [P]

| Preset | Elements | Spec-level | Props it adds |
| --- | --- | --- | --- |
| `corePreset` | Layout, content, display data | – | L0: `search`, `sort`, `pageSize`, `expand` |
| `interactivePreset` | Core + inputs, `Button`, `Form`, `Diff` | `state`, `when` | `filter`, `rowKey`, `select`, actions |
| `appPreset` | Interactive + `Split`, `Board` (later `Map`, `Calendar`) | Same | Binding `params`; higher limits |

- **Presets narrow only what is sent and accepted.** `readStoredSpec` always reads against the widest catalog, so a spec written under Interactive still loads for a host that sends Core. A host that lacks a component draws the `Fallback`.
- **Variants:** an entry can be registered in variants under one name. One component serves every preset, because the optional parts of the render contract are simply absent.
- **Per-agent narrowing** is the host's job [H].

### 4.5 How the package guides best practice [P]

- **Schema rules the model can't skip:** required labels on inputs, `Choice`, `Tab` and `Button`; `alt` on images; caps on state values.
- **Fixtures** (shipped): every entry's `example`, its own `fixtures`, and a mid-stream state. Each L0 element adds the states that apply to it: empty, filtered, selected, disabled.
- **Conformance checks** (shipped, `@intentface/chat/genui-testing`):
  - They draw every fixture through a component map in a real DOM.
  - They return failures as strings, so they work with any test runner.
  - Each new element brings its own role and interaction checks, for example `tab` and `tabpanel`, `columnheader` with `aria-sort`, `row` with `aria-selected`, `radiogroup` or `listbox`, and a labelled control for each input. They fire user events and check that the callbacks were called.
  - The docs examples pass them in CI.
- **Announcements:** the package works out structured announcements (rows matching, selection changes). An `Announcer` slot speaks them through overridable message functions with English defaults, the way `AskUser`'s labels already work.
- **A docs page per element,** with its contract, a behaviour checklist, its fixtures and the copy-paste example.

---

## 5. The catalog

Tiers: **C** is Core, **I** is Interactive, **A** is App. Status: **=** shipped, **Δ** changing, **+** new.

### 5.1 Layout

| Element | Tier | Status | Props | Notes |
| --- | --- | --- | --- | --- |
| `Card` | C | = | `title?`, `description?` | |
| `Stack` | C | Δ | `direction`, `gap`, + `align?`, + `wrap?` | |
| `Grid` | C | = | `columns: 2\|3\|4` | |
| `Tabs` | C | + | `value?` (`$state`, I) | Children must be `Tab` |
| `Tab` | C | + | `label` ≤40 (required), `badge?` ≤12 | Only inside `Tabs` |
| `Disclosure` | C | + | `title` ≤120, `open?: boolean \| $state` | |
| `Divider` | C | + | – | |
| `Split` | A | + | `ratio: 1:1\|1:2\|2:1` | Exactly two children |

### 5.2 Content

| Element | Tier | Status | Props | Notes |
| --- | --- | --- | --- | --- |
| `Heading` | C | = | `text` | |
| `Text` | C | = | `text` ≤1200, `tone?` | Stays plain text, escaped in Markdown |
| `Callout` | C | = | `tone`, `title?`, `text` | |
| `Badge` | C | + | `label` ≤40, `tone?` | |
| `Image` | C | + | `source: Target`, `alt` ≤160 (required), `aspect?` | Resolved and proxied by the host ([§7.3](#73-targets-links-and-images)) |
| `Code` | C | + | `language?`, `code` ≤4000 | |

### 5.3 Data

| Element | Tier | Status | Props | Notes |
| --- | --- | --- | --- | --- |
| `Metric` | C | Δ | + `unit?` ≤12 | `field` binding planned; `$expr` at L2 |
| `KeyValue` | C | Δ | + `unit?` per item | Same |
| `DataTable` | C | Δ | Column + `key?`, + `hidden?`, + `display?: text\|badge\|link\|bar`, + `unit?`. Table + `search?`, `sort?`, `pageSize?`, `expand?`; I: + `filter?`, `rowKey?`, `select?` | `display: "link"` only on bound columns ([§6.4](#64-column-and-field-keys)) |
| `Chart` | C | = | Unchanged | |
| `List` | C | + | `rows`, `fields?` (inline), `item: { title, subtitle?, meta? ≤3, badge?, image? }`, `search?`, `sort?`, `groupBy?`; I: + `rowKey?`, `select?` | |
| `Timeline` | C | + | `rows`, `fields?`, `item: { date, title, detail?, tone? }` | |
| `Checklist` | C | + | `items` as the `steps` view, + `checkable?` | |
| `Progress` | C | + | `label`, `value`, `max`, `format?` | |
| `Diff` | I | + | `fields: { label, before, after, format? }[]` ≤24, `note?` | Descriptive only; the `run` confirmation is the source of truth ([§7.2](#72-run-p-h)) |
| `Board` | A | + | `rows`, `fields?`, `lane`, `lanes?`, `item` as `List`, `rowKey?`, `select?` | Read-only |
| `Map`, `Calendar` | A | later | | |

### 5.4 Inputs (I)

Outside a `Form`, each input writes one state key via `value: { "$state": key }`. Inside a `Form`, inputs take a `name` instead ([§6.7](#67-forms)).

| Element | Props | State type |
| --- | --- | --- |
| `Choice` | `label` (required), `options: { value: string \| null, label }[]` 2–12, `display`, `multiple?` | `string \| null`, or `strings` |
| `NumberInput` | `label`, `min`, `max`, `step?`, `display: stepper\|slider\|field`, `format?`, `unit?` | `number` |
| `Toggle` | `label` | `boolean` |
| `TextInput` | `label`, `placeholder?`, `multiline?` | `string` ≤1000 |
| `DateInput` | `label`, `min?`, `max?` | `date` (ISO) |

Row selection (`select` on `DataTable`, `List` and `Board`) counts as an input too ([§6.6](#66-selection)).

**`Choice` or `AskUser`?**
- Use **`AskUser`** when the model needs an answer before it can continue.
- Use **`Choice`** when the person refines what is already on screen. Their next message carries the choice through the state line ([§8.1](#81-the-state-line-p-h)).

### 5.5 Actions (I)

| Element | Props | |
| --- | --- | --- |
| `Button` | `label` ≤40 (required), `action`, `tone?: primary\|secondary\|danger` | |
| `Form` | Container; `submit: { label, action }`, where the action is a `run` | Its fields fill `run.args` |

```ts
type Target = { ref: string; row?: string | StateRef; field?: string }; // a result, a row in it, a field of that row

type Action =
  | { do: "copy"; element?: string; text?: string }   // element → its Markdown
  | { do: "download"; element: string }               // the element's tables as CSV
  | { do: "open"; target: Target }                    // the host resolves and checks (§7.3)
  | { do: "set"; state: string; value: unknown }
  | { do: "run"; tool: RunnableTool; args: Record<string, unknown> }; // enum of runnable tools; args checked at acceptance
```

There is no action that sends a message (invariant 7).

### 5.6 Renderer slots [P]

| Slot | Status | Purpose |
| --- | --- | --- |
| `Placeholder`, `Pending`, `Unbound`, `Arrive`, `Fallback` | Shipped | |
| `Empty` | L0 | A table, list or board with no rows after filtering. The host owns the text. |
| `Announcer` | L0 | Speaks announcements. The default is a polite live region. |
| `Confirm` | L3 | Draws the `run` confirmation. **Required by type whenever the preset includes `run`.** Without it, `run` buttons aren't drawn. |

### 5.7 Coverage check

| Ask | Composition | Level |
| --- | --- | --- |
| Explain a product's parts | `Tabs` + `Text` + `Image` | L0 |
| Pipeline review | `Choice` → `DataTable` filter (search, sort, expand), plus a `Grid` of `Metric`s in another `Tab` | L0–L1 |
| Compare three options | `DataTable`, or a `Grid` of `Card` + `KeyValue` + `Badge` | L0 |
| Onboarding plan | `Checklist` (checkable) + `Callout` | L0 |
| Customer timeline | `Timeline` bound to a CRM result | L0 |
| Customer detail, in chat | `DataTable` with `expand` | L0 |
| Customer detail, in an app | `Split`: `List` with `select`, beside a `Card` bound with `params: { id: $state }` | L1, A |
| Refine a direction | `Choice` + `Toggle`; the person types the follow-up and the state line carries the choices | L1 |
| Proposed record update | `Diff` + `Button{run}` | L3 |
| Dinner for N guests | `NumberInput` + `KeyValue{$expr}` + `Checklist` + `Button{copy}` | L1+L2 |
| Savings projection | Needs a series over a range | **Not covered** |
| Games, audio tools | – | **Out of scope** |

---

## 6. Spec changes [P]

### 6.1 Declared state (L1)

The state declarations are a list, written before `elements`, with at most 12 entries.

```ts
type StateDecl =
  | { key: string; type: "string"; default: string | null }
  | { key: string; type: "strings"; default: string[] } // ≤12 values
  | { key: string; type: "number"; default: number; min?: number; max?: number }
  | { key: string; type: "boolean"; default: boolean }
  | { key: string; type: "date"; default: string | null };
```

String values are capped at 1,000 characters.

`{ "$state": key }` is accepted only in:
- input `value`
- `select`
- `Tabs.value`
- `Disclosure.open`
- `filter[].equals`
- binding `params`
- `Target.row`
- `run.args`
- `set`

### 6.2 UI state (shipped)

One shape covers both levels: `UiState = { keys, elements: { [id]: { tab?, open?, checked?, sort?, page?, search?, expanded? } } }`. A view's slice sits under `"$view"`.

| Part | Persisted | The model sees it |
| --- | --- | --- |
| Declared keys (including selections) | Yes | Yes, in labels |
| Checklist ticks | Yes | Yes. "I've done step 2" matters. |
| Open tab, disclosure | Yes | No |
| Sort, page, search, expanded rows | No | No |

`readState(input, stored)` drops pieces that have gone and fields of the wrong type. As each level lands, it also drops keys and columns that have gone, clamps values, and falls back to defaults on a type mismatch.

### 6.3 Conditions (L1)

```jsonc
{ "id": "detail", "type": "Card", "when": { "state": "showDetail", "is": true }, "children": [...] }
// ops: is, not, in
```

`when` is already reserved as an element-level key. Until L1, it's refused by name and its element isn't drawn.

### 6.4 Column and field keys

- **Defaults:** a column's `key` defaults to the source field name when the table is bound, and to the label when it's inline.
- **Uniqueness:** keys must be unique **only when something references them** (`sort`, `filter`, `rowKey`, `item`, `lane`). Render props pass cells in column order, so duplicate unreferenced keys lose nothing.
- **`hidden: true`** keeps a column available to logic but **hidden everywhere else**: on screen, in Markdown and in CSV.
- **Inline rows:** with bound rows, the binding's `columns` are the keys. With inline rows in `List`, `Timeline` and `Board`, `fields: string[]` names each position.
- **Links:** `display: "link"` is allowed only on bound columns. With inline rows, the model would have written the URL.

```jsonc
"columns": [{ "key": "id", "label": "Id", "hidden": true }, { "key": "stage", "label": "Deal stage", "display": "badge" }, …],
"filter": [{ "column": "stage", "equals": { "$state": "stage" } }]   // null matches everything
```

### 6.5 Filter options must match the data

When a `Choice` feeds a filter on a column whose rows are known at acceptance (inline, or bound and resolved), every non-null option must occur in that column. Otherwise the call is refused:

> `elements.stage.props.options.2.value: "Negotiation" doesn't occur in deals.stage. Values: proposal, negotiation, won.`

### 6.6 Selection

```jsonc
{ "id": "customers", "type": "List", "props": {
    "rows": { "$data": "queries/customers", "columns": ["id", "name", "city"] },
    "item": { "title": "name", "subtitle": "city" },
    "rowKey": "id",
    "select": { "$state": "customer" } } }
```

- Selection writes the row's key to a `string` key, or `null`. The first version is single selection only.
- What reads it already exists: binding `params` (in apps), `when`, `Target.row`, and `run.args`.
- A selected row that leaves the data keeps its key.
- **Described by** the item's title, or for a table, its first visible column.

### 6.7 Forms

- Inputs inside a `Form` take `name` instead of `value`. Their values fill only the submit `run.args`, never outer state.
- Inputs outside a Form stay live.

### 6.8 Expressions (L2, deferred)

- `{ "$expr": "guests * 0.4" }` in `Metric.value`, `KeyValue` values, `Progress.value` and `Text` interpolation.
- Numbers, state keys, `+ - * /`, comparisons, `round`, `min`, `max`, `floor`, `ceil`, `if`.
- No access to bound data.
- Parsed and type-checked at acceptance, and evaluated in the pure core.

### 6.9 New acceptance rules

| Rule | Message shape |
| --- | --- |
| State keys unique and camelCase; `$state` refs name a key | `elements.f.props.value: "stag" is not a state key. State keys: stage, owner.` |
| Input type matches the key's type | `elements.n.props.value: NumberInput writes a number; "stage" is a string.` |
| At most one input or selection writes a key | `"stage" is written by both "f1" and "f2"; give each its own key.` |
| `select` needs a `rowKey` | `elements.customers.props.select: set rowKey to the column that identifies a row.` |
| Inputs inside a `Form` use `name`; names unique within the Form | |
| Referenced keys exist and are unique | `elements.deals.props.filter.0.column: "Stage" is not a column key. Keys: id, company, stage, amount.` |
| Filter options occur in the data ([§6.5](#65-filter-options-must-match-the-data)) | |
| `display: "link"` only on bound columns | |
| `run.args` validate against the tool's input schema, with `$state` as typed placeholders and Form fields by name | `elements.save.props.action.args.amount: expected number; "stage" is a string.` |
| `Choice` default is one of its options; `when` matches the key's type; `Tab` only inside `Tabs`; state values within caps | |

### 6.10 Package API still to come

**Pure core (`@intentface/chat/genui`):**
- `isShown(element, state)`
- `viewRows(table, state)`: search, filter, sort and page in one place, shared by the renderer and the export.
- `stateSummary(spec, state, { since })`: the net difference from defaults for every UI changed since a given moment.
  - It's written in labels from the spec (option labels, row titles, joined lists), with no package-written English.
- `targetsOf(spec)`: every target, so the host can resolve them ahead of render, as it does bindings.
- New `exportSpec` options: `rows: "all" | "shown"` and `targets`.
- `fromFence`, `toFence` ([§10.1](#101-views-inside-documents)).

**Renderer (`@intentface/chat/genui-render`):**
- On `GenUi.Root`: `targets` (resolved, synchronous like `data`), `onAction(action, context): Promise<void>`, and `messages` for announcements.
- `useGenUiState(key)`.

### 6.11 Markdown

Escaping is shipped:
- Text from the model or a source reads literally.
- Bare addresses aren't linked.
- Links appear only from resolved targets.

As elements land:

| Element | Markdown |
| --- | --- |
| `Tabs` / `Tab` | Every tab as `#### label`, then its content |
| `Disclosure` | `#### title`, then content, always expanded |
| `when` | Follows the state passed (default: initial) |
| Inputs | `- **Guests:** 6`, in labels |
| Selection | `- **Selected:** Acme Oy`, only when set |
| `Checklist` | Task list, with ticks from state |
| `Button` | Omitted. An `open` becomes `[label](href)` when its target resolved. |
| `DataTable` | All rows by default; `rows: "shown"` for "copy as shown"; hidden columns left out |
| `List`, `Timeline`, `Board`, `Progress`, `Diff`, `Image`, `Code` | Bullets; dated bullets; lanes as `####` with lists; `3 of 8 (38%)`; a Field \| Before \| After table; `![alt](href)` or the alt text; a fenced block |
| `$expr` | Evaluated at the given state |

### 6.12 Copying (shipped)

Copying never loses a UI. Whatever the person copies, each UI in it arrives as its Markdown, at its current state, and one source serves every copy path: `exportSpec`.

| What is copied | Result | How |
| --- | --- | --- |
| **A whole message** | Text parts as written; each UI at its current `UiState` | [P] `partToMarkdown(part, { tools, state, data })`, and `targets` with L0 |
| **A text selection** that touches a UI | The UI's on-screen text is replaced with its **whole** Markdown, since half a table isn't meaningful Markdown. Plain text only. | [P] `copyWithGenUi` on the container's `onCopy`. [H] places `GenUi.Part` around each UI; it registers that UI's Markdown at its current state. |
| **One UI** (its own menu) | Copy as text, copy as shown, copy for a spreadsheet, download CSV | [H] a menu built on `exportSpec`, `toTsv` and `toCsv` |

An element drawn through `Fallback` copies the same way, from the same Markdown.

### 6.13 Versioning

- **Two numbers.** A spec records the base catalog version in `v`, and an extending catalog's version in `ext: { id, v }`, so extensions can move independently of the package.
- **`ext` status:** decided but not built yet. A missing `ext` will read as version 1, the same rule `v` follows.
- **Bump the base version in every release that adds entries or props,** with a migration that changes nothing. An older reader then says clearly that a spec is newer, rather than silently dropping what it can't read.
- **Store Markdown beside the spec** wherever specs outlive the reader. [H]
- **Readers use the widest catalog** ([§4.4](#44-catalog-presets-p)).
- **Every change to the sent schema** needs model checks ([§11](#11-model-checks-and-token-budget-h)) and a byte-for-byte schema comparison.

---

## 7. Actions, `run`, links and images

### 7.1 Simple actions [P]

- `copy` and `download` reuse `toMarkdown` and `exportSpec`.
- `set` writes state.
- `open` uses a resolved target.

### 7.2 `run` [P] [H]

**What may run, and acceptance:**
- **[H]** Each agent has an explicit **list of tools a UI may run**, empty by default. It is not every tool the agent has. The host passes the list to the tool helper as `runnable`.
- **[P]** `tool` is an enum of that list. `args` are validated against the tool's input schema, so the model gets the refusal instead of the person getting a failure on click.

**Confirmation:**
- **[P] The confirmation is the only source of truth.** On click, the package resolves `$state` and Form fields in `args`, and passes `{ tool, args }` to the required `Confirm` slot. `onAction` fires only after `Confirm` resolves.
- A `Diff` beside the button is the model's description, not the confirmation.
- **[H]** The confirmation is drawn from the real tool name and the resolved args.

**At click time [H]:**
- Re-authorise against the person who clicked and the agent's current grants.
- Re-validate the args.
- Ignore any identity written in the spec.
- Confirm again on every click. No approval is stored.
- In a shared app, run **as the viewer**.
- Record an idempotency key and an audit entry per run.

**Also:**
- **[P]** A button whose tool is no longer offered is drawn disabled. The spec still loads.
- **[H] Prerequisite:** the host can record a tool call that a person starts, not only one that a model turn makes.

### 7.3 Targets, links and images

- `Target` (`{ ref, row?, field? }`) is the one way to point at something: the `Image` source, `open`, and link cells. `{ ref, row, field }` means the value of `field` in that row of that result.
- **Resolution is synchronous at render.** The host resolves `targetsOf(spec)` ahead of time, including async lookups such as asset or proxy URLs, and passes them in as `targets`, as it does `data`. The export stays pure, and images don't flash in.
- **Host rules [H]:** https only, a host allowlist, and images always through an image proxy.
- Anything unresolved isn't drawn and isn't linked.

---

## 8. State, the model, and history

### 8.1 The state line [P] [H]

- **[P]** `stateSummary(spec, state, { since })` gives the net difference from defaults for **every UI changed since the last request**, in labels:
  - Option labels, not values.
  - Row titles, not ids.
  - Checklist ticks.
  - The spec's own label for `null`.
- **[H]** The host stores the summary with the user message and shows it there, for example as chips. The person sees exactly what the model was told, a replayed turn reproduces it, and the prompt-cache prefix stays stable.

### 8.2 Persistence [H]

- **In a chat:** the `UiState` snapshot is kept beside the tool call, keyed by its id.
- **In an app:** state is keyed by file and app, per person.
- Only the persisted parts are kept (`persistedState`, shipped).
- Read-only shares and docs demos use `defaultState` and persist nothing.

---

## 9. Accessibility

| Concern | Owner | How |
| --- | --- | --- |
| Labels | [P] | Required in the schema for inputs, `Choice`, `Tab` and `Button`; `alt` for `Image` |
| Keyboard for `Choice` chips and segmented controls | [C], checked by [P] | Radio-group semantics and arrow keys; `multiple` as checkboxes |
| Keyboard for `Tabs` | [C], checked by [P] | Arrow keys between tabs, `tab` / `tabpanel` roles |
| Row selection | [C], checked by [P] | Space or Enter selects; `aria-selected` |
| `Board` | [C], checked by [P] | Lanes as labelled lists; arrow keys between items |
| Sort | [C], checked by [P] | Header buttons; `aria-sort` |
| Announcements | [P] | Rows matching after a filter or search, selection changes; overridable messages |
| Motion | [P] | Existing reduced-motion handling covers new entrances |

---

## 10. Apps

"App" is the term for a stored spec, to avoid a third meaning of "view".

- **An app is a stored spec with `params`:** typed slots a host fills from outside (an API, an agent). **`params` is the one mechanism** for filling a stored spec.
- **Bindings take params from state:**

  ```jsonc
  "rows": { "$data": "queries/deals", "columns": ["company.name", "stage", "amount"],
            "params": { "stage": { "$state": "stage" } } }
  ```

  - **[P]** The renderer reports state changes.
  - **[H]** The host re-resolves and passes new `data`, debounced by a few hundred milliseconds.
  - Chat refuses `params`.
- **List and detail:** a `Split` with a selectable `List` beside a `Card` bound by `params: { id: { "$state": "customer" } }`.
- **Logic** lives in the host's server-side code. `run` calls it, then re-resolves.
- **Limits:** `appPreset` raises them, for example to 150 elements, depth 8 and 60 children.
- **Storage:** the spec, plus its escaped Markdown.

### 10.1 Views inside documents

A host that stores Markdown documents can embed a spec as a fenced `genui` block:

````md
```genui id=pipeline
{ "v": 2, "root": "card", "elements": { … } }
```
````

- **[P] Format.**
  - The fence holds a canonical spec: `v`, plus `ext` when the catalog is extended. It's the same shape that is stored for chat.
  - The info string carries a stable `id`, unique within the document. It keys the view's state and its bindings.
- **[P] Helpers.**
  - `fromFence(text, info, { catalog })` reads the block through `readStoredSpec` and returns the spec or errors.
  - `toFence(spec, { id })` writes it back with a stable key order, so diffs stay small.
- **[H] Checked when the document is saved.**
  - The host runs `canonicalSpec` on every fence and refuses the save with errors that name the field.
  - An agent writing the document gets those errors as its tool result, as in chat.
  - A document never holds a spec that wasn't accepted.
- **[H] Rendering.**
  - The document renderer maps `genui` fences to `GenUi.Spec`, resolving bindings and targets ahead of render.
  - `UiState` is kept per person, keyed by file and fence id.
  - A fence that fails to read shows its source as code, never a blank.
- **[H] Other readers.** When serving to agents, search or export, the host replaces each fence with its `exportSpec` Markdown. `onUnbound` lines say where unresolved data lives.

---

## 11. Model checks and token budget [H]

- **Scenarios:** each step that changes the sent schema adds scenarios to the host's model checks:
  - **L0:** the new flags.
  - **L1:** state, refs, selection, forms, filter options.
  - **L3:** actions and `run` args.
- **What to watch:**
  - The **first-call validity of the smallest model** on each step.
  - Growth in references as well as in elements.
- **Budget:** the full catalog is estimated at 8–9k tokens for the layout tool, before `state` and actions.
  - Presets keep Core agents near today's size.
  - If Interactive or App crosses about 10k, switch to sending element names only and loading details on demand.

---

## 12. Order of work

**Done: the first release** (`@intentface/chat` 0.6.0, experimental)
- The core, renderer and testing entries.
- The default catalog, with canonical specs and views, stored specs and migrations.
- Render props and `defineComponents`, `phase`, and the `Fallback` slot.
- `UiState`, controlled or uncontrolled.
- The tool helper, `compactHistory`, and copying.
- Fixtures and conformance checks.
- Escaped Markdown, the children cap in `Limits`, and `when` reserved.

**L0 and the new display elements** [P] [C]
- `Tabs`/`Tab`, `Disclosure`, `Divider`, `Badge`, `Code`, `Image`, `List`, `Timeline`, `Checklist`, `Progress`.
- `DataTable` search, sort, paging, expand, `display`, `hidden` and column `key`; `unit`.
- The `Empty` and `Announcer` slots.
- A docs example and conformance coverage for each element.
- `corePreset`. Version bump.
- [H] Target resolution with the link rules, before `Image` and link cells ship.

**L1** [P] [H]
- `state`, `$state`, `when`.
- `Choice`, `NumberInput`, `Toggle`, `TextInput`, `DateInput`.
- Filters with the option check ([§6.5](#65-filter-options-must-match-the-data)), and selection.
- `stateSummary` and `useGenUiState`.
- `interactivePreset`. Version bump.
- [H] Persistence, and the stored and shown state line.

**L3**
- [P] `Button` with `copy`, `download`, `open`, `set`.
- [H] Recording tool calls a person starts.
- [P] [H] `run`, `Confirm`, `Diff`, `Form`, the runnable list, and the host rules in [§7.2](#72-run-p-h).

**Apps** [P] [H]
- `params` on bindings.
- `appPreset` and its limits.
- `Split`, `Board`.
- `fromFence` and `toFence` ([§10.1](#101-views-inside-documents)).
- [H] Debounced re-resolution; Markdown stored beside the spec; save-time checks of fences; swapping fences for Markdown when served.

**On demand**
- L2 expressions.
- `Map`, `Calendar`.
- `range()` for projections.
- Image search.
- A "fill the composer" action, if one-tap follow-ups are missed.

---

## 13. Decisions

| Question | Decision |
| --- | --- |
| Who renders? | **Your components, through render props.** The package owns logic; components own interaction and styling. |
| Reference parts? | **No package parts.** Copy-paste examples in the docs, native where accessible. Conformance checks in the package. |
| A UI that sends messages (`ask`)? | **No.** The person types; the state line carries their choices. |
| First release | **Ships the render contract, experimental.** Later steps only add elements and props. |
| Presets | **Narrow what is sent and accepted;** readers use the widest catalog |
| Versioning | **Base `v` plus `ext: { id, v }`;** bump the base on every release that adds entries or props |
| L0 state | **One `UiState` shape.** Persist ticks, tab and disclosure; the model sees keys, selection and ticks. |
| Column keys | **Default to the field name when bound, the label when inline;** unique only when referenced; cells in column order |
| Filter options | **Refused at acceptance** when they don't occur in the data |
| `run` | **Explicit runnable list per agent, empty by default;** args checked at acceptance; the confirmation is the only truth |
| Targets | **One `Target` type,** resolved ahead of render, synchronous |
| Markdown | **Escaped;** links only from resolved targets; hidden columns hidden everywhere |
| Copying | **Every copy path yields Markdown** at the current state; a selection that touches a UI copies the whole UI |
| State line | **Every UI changed since the last request, in labels,** stored with the message and shown to the person |
| Package text | **No hard-coded English.** Labels from the spec; overridable messages. |
| Inline Markdown in `Text` | **No** |
| Master/detail | **`expand` in chat; selection plus params in apps** |
| Filling stored specs | **One mechanism: `params`** |
| UI in chat | **Always a tool call.** Never a spec in reply text. |
| Views in documents | **Fenced `genui` blocks,** checked when saved, swapped for Markdown when served |
| Images | **Targets only,** proxied |
| First write action | **`Diff` + `run`** |
| Names | `Checklist`, `NumberInput`, `DisplayCell`, `onClick`; stored specs are "apps" |

## 14. Open questions

- What should the default debounce be for re-resolving bound data?
- Does `select` ever need multiple rows? Bulk actions would be the reason.
- Do apps need a standalone file, or is a document holding one fenced view enough?
- Should a fence be able to reference a stored app with param values (`app=apps/pipeline region=Helsinki`) instead of holding the spec, so one view can be reused across documents?
- Should a checkable `Checklist` in an app share state between people, rather than keep it per person?
- When does `ext` land? It has to come before any extended spec is stored in a document.
