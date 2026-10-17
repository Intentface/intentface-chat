import { describe, expect, test } from "bun:test";
import { bindingRefs, hasBinding, withData } from "../src/genui/bindings";
import { defaultCatalog } from "../src/genui/catalog";
import type { ElementDefinition } from "../src/genui/define";
import { exportSpec, exportView, toMarkdown, viewToMarkdown } from "../src/genui/export";
import { markdownTable, toCsv } from "../src/genui/markdown";
import { specSchemas } from "../src/genui/spec";

const { elements, views } = defaultCatalog;
// Server-rendered Markdown is stored and indexed, so these tests pin both.
const fixed = { locale: "en-GB", timeZone: "UTC" } as const;

describe("every entry has a Markdown fallback", () => {
  test.each(Object.keys(views))("view %s: its example reads as Markdown", (name) => {
    expect(
      viewToMarkdown(
        { view: name, props: views[name as keyof typeof views].example },
        fixed,
      ).trim(),
    ).not.toBe("");
  });

  test.each(Object.keys(elements))("element %s: its example reads as Markdown", (name) => {
    // Widened: the loop meets every entry, so its props are each entry's own.
    const element: ElementDefinition = elements[name as keyof typeof elements];
    const props = element.props.parse(element.example);
    expect(typeof element.toMarkdown(props, { children: ["- child"], ...fixed })).toBe("string");
  });

  test.each(Object.keys(elements))("element %s: its example is a valid spec", (name) => {
    const element = elements[name as keyof typeof elements];
    const spec = { root: "x", elements: { x: { type: name, props: element.example } } };
    expect(specSchemas().ResolvedSpecSchema.safeParse(spec).success).toBe(true);
  });
});

describe("exportView", () => {
  test("offers a table's raw rows, header first, named by its title", () => {
    const exported = exportView({ view: "table", title: "Deals", props: views.table.example });
    expect(exported?.tables).toEqual([
      {
        name: "Deals",
        rows: [
          ["Account", "Stage", "Value"],
          ["Northwind", "Proposal", 42000],
          ["Globex", "Discovery", 18500],
          ["Initech", "Negotiation", 67000],
        ],
      },
    ]);
  });

  test("offers a chart's data, one column per series", () => {
    const exported = exportView({ view: "chart", props: views.chart.example });
    expect(exported?.tables[0]?.rows.slice(0, 2)).toEqual([
      ["", "New", "Renewed"],
      ["Jan", 12, 8],
    ]);
    expect(exported?.tables[0]?.name).toBe("Chart");
  });

  test("writes an email as the plain text a mail client expects", () => {
    const markdown = viewToMarkdown({ view: "email", props: views.email.example });
    expect(markdown.startsWith("To: jonas@northwind.example\nSubject: Your renewal")).toBe(true);
    expect(markdown).not.toContain("**");
  });

  test("reads props written beside `view`", () => {
    expect(viewToMarkdown({ view: "steps", items: [{ title: "Do it" }] })).toBe("- [ ] Do it");
  });
});

describe("exportSpec", () => {
  const layout = {
    root: "c",
    elements: [
      { id: "c", type: "Card", props: { title: "Q3" }, children: ["g", "h", "t", "ch"] },
      { id: "g", type: "Grid", props: { columns: 2 }, children: ["m1", "m2"] },
      { id: "m1", type: "Metric", props: { label: "Socks", value: 47, delta: 23 } },
      { id: "m2", type: "Metric", props: { label: "Mugs", value: 9 } },
      { id: "h", type: "Heading", props: { text: "Suspects" } },
      { id: "t", type: "DataTable", props: elements.DataTable.example },
      { id: "ch", type: "Chart", props: elements.Chart.example },
    ],
  };

  test("reads top to bottom, metrics as one list", () => {
    const markdown = toMarkdown(layout);
    expect(markdown.startsWith("### Q3\n\n- **Socks:** 47 (+23%)\n- **Mugs:** 9")).toBe(true);
    expect(markdown.indexOf("#### Suspects")).toBeLessThan(markdown.indexOf("| Account |"));
  });

  test("names each table by the heading before it, else the card it is in", () => {
    expect(exportSpec(layout)?.tables.map((table) => table.name)).toEqual(["Suspects", "Q3"]);
  });

  test("numbers tables nothing names, and tells two of one name apart", () => {
    const bare = {
      root: "s",
      elements: [
        { id: "s", type: "Stack", props: {}, children: ["a", "b"] },
        { id: "a", type: "DataTable", props: elements.DataTable.example },
        { id: "b", type: "DataTable", props: elements.DataTable.example },
      ],
    };
    expect(exportSpec(bare)?.tables.map((table) => table.name)).toEqual(["Table 1", "Table 2"]);
  });

  test("reads a canonical spec as it reads model input", () => {
    const canonical = {
      v: 1,
      root: "c",
      elements: {
        c: { type: "Card", props: { title: "Q3" }, children: ["m"] },
        m: { type: "Metric", props: { label: "Socks", value: 47 } },
      },
    };
    expect(toMarkdown(canonical)).toBe("### Q3\n\n- **Socks:** 47");
  });
});

describe("bound data", () => {
  const bound = {
    root: "c",
    elements: [
      { id: "c", type: "Card", props: { title: "Branches" }, children: ["t"] },
      {
        id: "t",
        type: "DataTable",
        props: {
          columns: [{ label: "Branch" }, { label: "Paid", format: "number" }],
          rows: { $data: "file_8Hq2/query:paid", columns: ["branch", "paid"] },
        },
      },
    ],
  };

  test("is swapped in where `data` has it", () => {
    const data = {
      "elements.t.props.rows": [
        ["Bath", 1200],
        ["York", 950],
      ],
    };
    expect(toMarkdown(bound, { data, ...fixed })).toBe(
      "### Branches\n\n| Branch | Paid |\n| --- | --- |\n| Bath | 1,200 |\n| York | 950 |",
    );
  });

  test("is left out when unresolved, unless the consumer says what to write", () => {
    expect(toMarkdown(bound)).toBe("### Branches");

    const markdown = toMarkdown(bound, {
      onUnbound: (piece) => `_${piece.type} "${piece.id}" reads from ${piece.refs.join(", ")}._`,
    });
    expect(markdown).toBe('### Branches\n\n_DataTable "t" reads from file_8Hq2/query:paid._');
  });

  test("in a view, is written by onUnbound too", () => {
    const view = {
      view: "table",
      props: { columns: [{ label: "A" }], rows: { $data: "q1", columns: ["a"] } },
    };
    expect(exportView(view)).toBeNull();
    expect(
      viewToMarkdown(view, { onUnbound: (piece) => `(${piece.type} from ${piece.refs[0]})` }),
    ).toBe("(table from q1)");
  });

  test("withData files values by position, never by ref", () => {
    const value = { a: { $data: "r", column: "x" }, b: [{ $data: "r", column: "x" }] };
    expect(withData(value, { a: [1], "b.0": [2] })).toEqual({ a: [1], b: [[2]] });
    expect(withData(value, {})).toEqual(value);
    expect(hasBinding(value)).toBe(true);
    expect(hasBinding({ a: [1, { b: "c" }] })).toBe(false);
    expect(bindingRefs({ x: { $data: "r1" }, y: [{ $data: "r2" }, { $data: "r1" }] })).toEqual([
      "r1",
      "r2",
    ]);
  });
});

describe("locale and time zone", () => {
  const record = {
    view: "record",
    props: {
      name: "Northwind",
      fields: [
        { label: "ARR", value: 86000.5, format: "number" },
        { label: "Renewal", value: "2026-11-30", format: "date" },
        { label: "Signed", value: "2026-03-01T23:30:00Z", format: "date" },
      ],
    },
  };

  test("are the caller's, so a server writes the same Markdown on every host", () => {
    const helsinki = viewToMarkdown(record, { locale: "fi-FI", timeZone: "Europe/Helsinki" });
    expect(helsinki).toMatch(/86\s000,5/); // fi-FI groups with a no-break space
    // A timestamp is an instant, shown in the zone asked for: the next day in Helsinki.
    expect(helsinki).toContain("2.3.2026");
    expect(viewToMarkdown(record, fixed)).toContain("1 Mar 2026");
  });

  test("never move a calendar date to the evening before", () => {
    for (const timeZone of ["UTC", "America/New_York", "Pacific/Honolulu"]) {
      expect(viewToMarkdown(record, { locale: "en-GB", timeZone })).toContain("30 Nov 2026");
    }
  });
});

describe("text helpers", () => {
  test("quote CSV fields that need it, and mark the file as UTF-8", () => {
    const csv = toCsv([
      ["Name", "Note"],
      ["A, B", 'Said "hi"'],
      ["Line\nbreak", null],
    ]);
    expect(csv).toBe('﻿Name,Note\r\n"A, B","Said ""hi"""\r\n"Line\nbreak",\r\n');
  });

  test("keep a pipe in a cell from splitting a Markdown column", () => {
    expect(markdownTable(["A"], [["x | y"]])).toBe("| A |\n| --- |\n| x \\| y |");
  });
});
