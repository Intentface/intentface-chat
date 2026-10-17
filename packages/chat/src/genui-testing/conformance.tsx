import { queryAllByRole } from "@testing-library/dom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { type Catalog, type DefaultCatalog, defaultCatalog } from "../genui/catalog";
import type { RenderContext } from "../genui/define";
import { type Fixture, fixtures } from "../genui/fixtures";
import type { FormatOptions } from "../genui/format";
import { GenUi, type GenUiComponentMap } from "../genui-render";

/**
 * Conformance: whether a component map draws what its render props promise.
 *
 * Every fixture of the catalog (`fixtures`) is drawn through your map, in a
 * real DOM, and checked by what a reader gets — text on screen, roles a
 * screen reader announces — not by markup or class names, so any design
 * system can pass. Failures come back as strings, like `checkSpec`'s, so
 * this works under any test runner:
 *
 *     expect(await checkComponents(components, { catalog })).toEqual([]);
 *
 * Needs a DOM (happy-dom, jsdom) and `@testing-library/dom`. The checks grow
 * with the catalog: interactive pieces bring their keyboard and ARIA checks.
 */
export type ConformanceOptions<C extends Catalog = DefaultCatalog> = FormatOptions & {
  /** The catalog the map draws. The default catalog when omitted. */
  catalog?: C;
};

type Render = Record<string, unknown>;
type Parseable = { safeParse: (value: unknown) => { success: boolean; data?: unknown } };

const strings = (...values: unknown[]) =>
  values.filter((value): value is string => typeof value === "string" && value.trim() !== "");

const normal = (text: string) => text.replace(/\s+/g, " ").trim();

const items = (list: unknown) =>
  Array.isArray(list)
    ? list.flatMap((item: { label?: unknown; text?: unknown }) => strings(item.label, item.text))
    : [];

const metricTexts = (metric: Render) =>
  strings(metric.label, metric.text, (metric.delta as Render | undefined)?.text);

const tableTexts = (table: Render) => [
  ...strings(...((table.columns as Render[]) ?? []).map((column) => column.label)),
  ...((table.rows as { cells: Render[] }[]) ?? []).flatMap((row) =>
    strings(...row.cells.map((cell) => cell.text)),
  ),
];

/** The text a built-in piece promises its reader, from its render props. */
const expectedText = (fixture: Fixture, render: Render): string[] => {
  const view = fixture.kind === "view";
  switch (view ? `view:${fixture.type}` : fixture.type) {
    case "Card":
      return strings(render.title, render.description);
    case "Heading":
    case "Text":
      return strings(render.text);
    case "Callout":
      return strings(render.title, render.text);
    case "Metric":
      return metricTexts(render);
    case "KeyValue":
      return items(render.items);
    case "DataTable":
    case "view:table":
      return tableTexts(render);
    case "view:metrics":
      return ((render.items as Render[]) ?? []).flatMap(metricTexts);
    case "view:record":
      return [
        ...strings(render.name, render.subtitle, (render.status as Render | undefined)?.label),
        ...items(render.fields),
        ...strings(render.note),
      ];
    case "view:email":
      return strings(render.subject, render.body, ...((render.to as unknown[]) ?? []));
    case "view:steps":
      return ((render.items as Render[]) ?? []).flatMap((item) => strings(item.title, item.detail));
    default:
      return [];
  }
};

/** The piece's render props, as the renderer computes them. */
const renderOf = (
  catalog: Catalog,
  fixture: Fixture,
  format: FormatOptions,
): Render | undefined => {
  const entry =
    fixture.kind === "view" ? catalog.views[fixture.type] : catalog.elements[fixture.type];
  if (!entry) return undefined;
  const source = fixture.input as {
    props?: unknown;
    elements?: { id: string; props: unknown }[];
  };
  const loose =
    fixture.kind === "view"
      ? source.props
      : source.elements?.find((element) => element.id === "piece")?.props;
  const settled =
    fixture.phase === "streaming" && entry.settle ? entry.settle(loose, false) : loose;
  const parsed = (entry.props as Parseable).safeParse(settled);
  if (!parsed.success) return undefined;
  const context: RenderContext = {
    ...format,
    phase: fixture.phase,
    state: {},
    update: () => {},
  };
  return (entry.toRender ? entry.toRender(parsed.data, context) : parsed.data) as Render;
};

/** Draws one fixture through the map into a detached-from-nothing container. */
const draw = async (
  catalog: Catalog,
  components: GenUiComponentMap<Catalog>,
  fixture: Fixture,
  format: FormatOptions,
) => {
  const container = document.createElement("div");
  document.body.append(container);
  const errors: unknown[] = [];
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <GenUi.Root
        catalog={catalog}
        components={components}
        onError={(error) => errors.push(error)}
        phase={fixture.phase}
        {...format}
      >
        {fixture.kind === "view" ? (
          <GenUi.View input={fixture.input} />
        ) : (
          <GenUi.Spec input={fixture.input} />
        )}
      </GenUi.Root>,
    );
  });
  const done = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  return { container, errors, done };
};

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Text the render props promise that isn't on screen: the first few, then a count. */
const missingText = (fixture: Fixture, render: Render, text: string) => {
  const absent = expectedText(fixture, render).filter(
    (expected) => !text.includes(normal(expected)),
  );
  const lines = absent
    .slice(0, 3)
    .map((expected) => `${fixture.name}: "${normal(expected).slice(0, 60)}" isn't on screen.`);
  if (absent.length > 3) lines.push(`${fixture.name}: …and ${absent.length - 3} more texts.`);
  return lines;
};

/** A table's header and row roles, which a screen reader navigates by. */
const tableRoles = (fixture: Fixture, render: Render, container: HTMLElement) => {
  const isTable = fixture.type === (fixture.kind === "view" ? "table" : "DataTable");
  const columns = (render.columns as unknown[] | undefined)?.length ?? 0;
  const rows = (render.rows as unknown[] | undefined)?.length ?? 0;
  if (!isTable || rows === 0) return [];
  const lines: string[] = [];
  const headers = queryAllByRole(container, "columnheader").length;
  if (headers < columns) {
    lines.push(
      `${fixture.name}: ${columns} columns need ${columns} column headers (role columnheader); found ${headers}.`,
    );
  }
  const drawnRows = queryAllByRole(container, "row").length;
  if (drawnRows < rows + 1) {
    lines.push(
      `${fixture.name}: ${rows} rows and a header need ${rows + 1} rows (role row); found ${drawnRows}.`,
    );
  }
  return lines;
};

/** A heading's text in an element with the heading role. */
const headingRole = (fixture: Fixture, render: Render, container: HTMLElement) => {
  if (fixture.kind !== "element" || fixture.type !== "Heading") return [];
  const wanted = normal(String(render.text ?? ""));
  const headings = queryAllByRole(container, "heading").map((heading) =>
    normal(heading.textContent ?? ""),
  );
  return headings.some((heading) => heading.includes(wanted))
    ? []
    : [`${fixture.name}: its text isn't a heading (role heading).`];
};

/** A container's fixture holds one child; its text must be on screen. */
const drawsChildren = (catalog: Catalog, fixture: Fixture, text: string, format: FormatOptions) => {
  if (fixture.kind !== "element" || !catalog.elements[fixture.type]?.container) return [];
  const { elements } = fixture.input as { elements: { id: string; type: string }[] };
  const child = elements.find((element) => element.id === "child");
  const entry = child ? catalog.elements[child.type] : undefined;
  if (!child || !entry) return [];
  const piece = {
    ...fixture,
    type: child.type,
    input: { elements: [{ id: "piece", props: entry.example }] },
  };
  const render = renderOf(catalog, piece, format);
  const wanted = render ? expectedText(piece, render) : [];
  return wanted.every((expected) => text.includes(normal(expected)))
    ? []
    : [`${fixture.name}: it doesn't draw its children.`];
};

/** Draws one fixture and returns what fails. */
const checkFixture = async (
  catalog: Catalog,
  map: GenUiComponentMap<Catalog>,
  fixture: Fixture,
  format: FormatOptions,
): Promise<string[]> => {
  const { container, errors, done } = await draw(catalog, map, fixture, format);
  try {
    if (errors.length > 0) return [`${fixture.name}: the component threw: ${message(errors[0])}`];
    const text = normal(container.textContent ?? "");
    if (text === "" && container.querySelector("*") === null) {
      return [`${fixture.name}: drew nothing.`];
    }
    const render = renderOf(catalog, fixture, format);
    return [
      ...(render
        ? [
            ...missingText(fixture, render, text),
            ...tableRoles(fixture, render, container),
            ...headingRole(fixture, render, container),
          ]
        : []),
      ...drawsChildren(catalog, fixture, text, format),
    ];
  } finally {
    await done();
  }
};

const hasComponent = (map: GenUiComponentMap<Catalog>, fixture: Fixture) =>
  fixture.kind === "view"
    ? Boolean((map.views as Record<string, unknown> | undefined)?.[fixture.type])
    : Boolean((map.elements as Record<string, unknown>)[fixture.type]);

/**
 * Draws every fixture of the catalog through the map and returns what fails,
 * one line each: a piece that throws or draws nothing, text the render props
 * promise that isn't on screen, a table without its header and row roles,
 * a heading without the heading role, a container that drops its children,
 * a piece with no component at all.
 */
export const checkComponents = async <C extends Catalog = DefaultCatalog>(
  components: GenUiComponentMap<C>,
  { catalog: given, locale, timeZone }: ConformanceOptions<C> = {},
): Promise<string[]> => {
  const catalog = (given ?? defaultCatalog) as Catalog;
  const map = components as unknown as GenUiComponentMap<Catalog>;
  const format = { locale, timeZone };
  const failures: string[] = [];
  const missing = new Set<string>();

  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const wasActEnvironment = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    for (const fixture of fixtures(catalog)) {
      if (hasComponent(map, fixture)) {
        failures.push(...(await checkFixture(catalog, map, fixture, format)));
        continue;
      }
      const label = fixture.kind === "view" ? `${fixture.type} view` : fixture.type;
      if (!missing.has(label))
        failures.push(`${label}: no component; it would draw through Fallback.`);
      missing.add(label);
    }
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = wasActEnvironment;
  }
  return failures;
};
