import { describe, expect, test } from "bun:test";
import { renderHook } from "@testing-library/react";
import { z } from "zod";
import { defineCatalog } from "../src/generative/catalog";
import { useTree } from "../src/generative/use-tree";

const catalog = defineCatalog({
  components: {
    Metric: {
      description: "One key number with a label.",
      props: z.object({ label: z.string(), tone: z.enum(["positive", "negative"]) }),
    },
    Table: {
      description: "Rows to compare.",
      props: z.object({ rows: z.array(z.array(z.string())) }),
      bind: ["rows"],
    },
  },
});

const metric = (tone: string) => ({ type: "Metric", props: { label: "Total", tone } });

describe("useTree", () => {
  test("holds a node's last valid props while the input streams", () => {
    const { result, rerender } = renderHook(
      ({ input, streaming }) => useTree(input, catalog, { streaming }),
      { initialProps: { input: metric("positive") as unknown, streaming: true } },
    );
    expect(result.current.root?.props).toEqual({ label: "Total", tone: "positive" });

    // An enum caught mid-word fails for one chunk; the node keeps what it had.
    rerender({ input: metric("neg"), streaming: true });
    expect(result.current.root?.status).toBe("ready");
    expect(result.current.root?.props).toEqual({ label: "Total", tone: "positive" });

    rerender({ input: metric("negative"), streaming: true });
    expect(result.current.root?.props).toEqual({ label: "Total", tone: "negative" });
  });

  test("holds nothing once the input is whole", () => {
    const { result, rerender } = renderHook(
      ({ input, streaming }) => useTree(input, catalog, { streaming }),
      { initialProps: { input: metric("positive") as unknown, streaming: true } },
    );
    rerender({ input: metric("neg"), streaming: false });
    expect(result.current.root?.status).toBe("pending");
  });

  test("settles with an inline resolve instead of re-rendering forever", () => {
    const input = { type: "Table", props: { rows: { $data: "deals_1", columns: ["company"] } } };
    const { result, rerender } = renderHook(() =>
      useTree(input, catalog, {
        streaming: true,
        resolve: () => [{ company: "Aalto Labs", stage: "Proposal" }],
      }),
    );
    rerender();
    rerender();
    expect(result.current.root?.status).toBe("ready");
    expect(result.current.root?.props).toEqual({ rows: [["Aalto Labs"]] });
  });
});
