import { describe, expect, test } from "bun:test";
import { createDefaultCatalog, defaultCatalog, defineCatalog } from "../src/genui/catalog";
import {
  canonicalSpec,
  checkSpec,
  migrateSpec,
  readSpec,
  readStoredSpec,
  type Spec,
  specSchemas,
} from "../src/genui/spec";

const text = (value: string) => ({ type: "Text", props: { text: value } });
const stack = (...children: string[]) => ({ type: "Stack", props: {}, children });
const { limits } = defaultCatalog;

describe("checkSpec", () => {
  test("accepts a tree, and ignores elements nothing points at", () => {
    const spec: Spec = { root: "s", elements: { s: stack("a"), a: text("a"), stray: text("x") } };
    expect(checkSpec(spec)).toEqual([]);
  });

  test("names a missing root", () => {
    expect(checkSpec({ root: "nope", elements: { a: text("a") } })).toEqual([
      'The root "nope" is not one of the elements.',
    ]);
  });

  test("names a dangling child", () => {
    expect(checkSpec({ root: "s", elements: { s: stack("a", "ghost"), a: text("a") } })).toEqual([
      'Element "s" lists child "ghost", which is not one of the elements.',
    ]);
  });

  test("refuses an element with two parents", () => {
    const errors = checkSpec({
      root: "r",
      elements: { r: stack("x", "y"), x: stack("t"), y: stack("t"), t: text("t") },
    });
    expect(errors.join()).toContain('"t" is a child of both');
  });

  test("catches a cycle", () => {
    const errors = checkSpec({ root: "a", elements: { a: stack("b"), b: stack("a") } });
    expect(errors.join()).toContain("contains itself");
  });

  test("enforces depth and size", () => {
    const deep: Spec["elements"] = {};
    for (let i = 0; i < limits.depth + 1; i++) deep[`n${i}`] = stack(`n${i + 1}`);
    deep[`n${limits.depth + 1}`] = text("leaf");
    expect(checkSpec({ root: "n0", elements: deep }).join()).toContain("nested");

    const wide: Spec["elements"] = { r: stack() };
    for (let i = 0; i < limits.elements; i++) wide[`t${i}`] = text("t");
    expect(checkSpec({ root: "r", elements: wide }).join()).toContain("the limit is 40");
  });

  test("takes its limits from the catalog, or from the call", () => {
    const wide: Spec["elements"] = { r: stack() };
    for (let i = 0; i < 60; i++) wide[`t${i}`] = text("t");
    const spec = { root: "r", elements: wide };
    const documents = defineCatalog({ ...defaultCatalog, limits: { elements: 120 } });

    expect(checkSpec(spec)).not.toEqual([]);
    expect(checkSpec(spec, { catalog: documents })).toEqual([]);
    expect(checkSpec(spec, { limits: { elements: 100 } })).toEqual([]);
    expect(checkSpec(spec, { catalog: documents, limits: { elements: 50 } }).join()).toContain(
      "the limit is 50",
    );
  });

  test("caps a container's children from the catalog, which the model's schema carries", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `t${i}`);
    const elements = [{ id: "s", ...stack(...ids) }, ...ids.map((id) => ({ id, ...text(id) }))];
    const input = { root: "s", elements };
    const roomy = defineCatalog({ ...defaultCatalog, limits: { elements: 120, children: 60 } });

    // The default allows 24, and tells the model so.
    expect(JSON.stringify(specSchemas().SpecInputSchema.toJSONSchema())).toContain(
      '"maxItems":24',
    );
    expect(canonicalSpec(input).ok).toBe(false);
    expect(canonicalSpec(input, { catalog: roomy }).ok).toBe(true);
    // A single check can lower it.
    const tight = canonicalSpec(input, { catalog: roomy, limits: { children: 10 } });
    expect(tight.ok ? "" : tight.errors.join()).toContain('"s" lists 30 children; the limit is 10');
  });
});

describe("readSpec", () => {
  test("reads half-written input without throwing", () => {
    expect(readSpec(undefined)).toEqual({ root: undefined, elements: {} });
    expect(readSpec({ root: "c", elements: { c: { type: "Car" } } })).toEqual({
      root: "c",
      elements: {},
    });
  });

  test("keeps children only on containers", () => {
    const spec = readSpec({
      root: "c",
      elements: {
        c: { type: "Card", props: {}, children: ["t", 3] },
        t: { type: "Text", props: { text: "x" }, children: ["c"] },
      },
    });
    expect(spec.elements.c?.children).toEqual(["t"]);
    expect(spec.elements.t?.children).toEqual([]);
  });

  test("knows only the catalog it is given", () => {
    const narrow = defineCatalog({ version: 1, elements: { Text: defaultCatalog.elements.Text } });
    const input = { root: "c", elements: { c: stack("t"), t: text("x") } };
    expect(Object.keys(readSpec(input, narrow).elements)).toEqual(["t"]);
  });
});

describe("canonicalSpec", () => {
  const input = {
    root: "card",
    elements: [
      { id: "card", type: "Card", props: { title: "Q3" }, children: ["rows"] },
      {
        id: "rows",
        component: "DataTable",
        columns: [{ label: "Branch" }],
        rows: { $data: "saved-query:branches", columns: ["name"] },
      },
    ],
  };

  test("turns the model's list into elements by id, stamped with the catalog version", () => {
    const result = canonicalSpec(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.v).toBe(1);
    expect(Object.keys(result.spec.elements)).toEqual(["card", "rows"]);
    // The slips are put right: `component` read as `type`, props beside it as props.
    expect(result.spec.elements.rows).toEqual({
      type: "DataTable",
      props: {
        columns: [{ label: "Branch" }],
        rows: { $data: "saved-query:branches", columns: ["name"] },
      },
    });
  });

  test("keeps bindings, whatever their ref looks like", () => {
    for (const ref of ["d3f9a1c", "file_abc123", "saved-query:branches", "x"]) {
      const result = canonicalSpec({
        root: "t",
        elements: [
          {
            id: "t",
            type: "DataTable",
            props: { columns: [{ label: "A" }], rows: { $data: ref, columns: ["a"] } },
          },
        ],
      });
      expect(result.ok).toBe(true);
    }
  });

  test("refuses two elements with one id, and a tree that doesn't hold", () => {
    const twice = canonicalSpec({
      root: "a",
      elements: [text("x"), text("y")].map((e) => ({ ...e, id: "a" })),
    });
    expect(twice).toEqual({
      ok: false,
      errors: ['elements: more than one element has the id "a".'],
    });

    const dangling = canonicalSpec({ root: "s", elements: [{ id: "s", ...stack("ghost") }] });
    expect(dangling.ok).toBe(false);
  });

  test("names the field that is wrong", () => {
    const result = canonicalSpec({
      root: "t",
      elements: [{ id: "t", type: "Text", props: { text: 3 } }],
    });
    expect(result.ok ? [] : result.errors.join()).toContain("elements.t.props.text");
  });
});

describe("stored specs", () => {
  const stored = { v: 1, root: "t", elements: { t: text("Kept for years") } };

  test("read back as they were written", () => {
    expect(readStoredSpec(stored)).toEqual({ ok: true, spec: stored });
  });

  test("with no version, are read as v1", () => {
    const { v: _, ...unversioned } = stored;
    expect(readStoredSpec(unversioned)).toEqual({ ok: true, spec: stored });
  });

  test("are read strictly: the model's slips are not forgiven once stored", () => {
    const slipped = { v: 1, root: "t", elements: { t: { component: "Text", text: "x" } } };
    expect(readStoredSpec(slipped).ok).toBe(false);
  });

  test("from a newer catalog are refused rather than guessed at", () => {
    const result = readStoredSpec({ ...stored, v: 3 });
    expect(result.ok ? "" : result.errors.join()).toContain("version 3");
  });

  test("come forward one migration at a time", () => {
    // v2 renamed Text to Paragraph; v3 changed nothing a stored spec sees.
    const { Text, ...rest } = defaultCatalog.elements;
    const v3 = defineCatalog({
      version: 3,
      elements: { ...rest, Paragraph: Text },
      migrations: {
        1: (spec) => {
          const old = spec as Spec;
          return {
            ...old,
            elements: Object.fromEntries(
              Object.entries(old.elements).map(([id, element]) => [
                id,
                element.type === "Text" ? { ...element, type: "Paragraph" } : element,
              ]),
            ),
          };
        },
      },
    });

    expect(migrateSpec(stored, 1, v3)).toEqual({
      v: 3,
      root: "t",
      elements: { t: { type: "Paragraph", props: { text: "Kept for years" } } },
    });
    expect(readStoredSpec(stored, { catalog: v3 }).ok).toBe(true);
    expect(migrateSpec(stored, 1)).toEqual(stored);
  });
});

describe("the schema the model is sent", () => {
  test("is the list form, every element naming its id", () => {
    const { SpecInputSchema } = specSchemas();
    const parsed = SpecInputSchema.safeParse({
      root: "t",
      elements: [{ id: "t", type: "Text", props: { text: "x" } }],
    });
    expect(parsed.success).toBe(true);
  });

  test("is built once per catalog", () => {
    expect(specSchemas(defaultCatalog)).toBe(specSchemas(defaultCatalog));
  });

  test("carries the consumer's words for a ref, and its row cap", () => {
    const custom = createDefaultCatalog({ refDescription: "The ref line's value.", maxRows: 3 });
    const table = custom.elements.DataTable;
    const rows = Array.from({ length: 4 }, () => ["x"]);
    expect(table.props.safeParse({ columns: [{ label: "A" }], rows }).success).toBe(false);
    expect(JSON.stringify(table.input?.toJSONSchema())).toContain("The ref line's value.");
  });
});
