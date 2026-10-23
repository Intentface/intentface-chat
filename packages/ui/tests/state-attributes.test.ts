import { describe, expect, test } from "bun:test";
import { getStateAttributesProps } from "../src/internal/render/getStateAttributesProps";

// Coverage for the vendored state → data-* derivation. The primitives publish all of their
// styleable state through this, so a drift here is a silent restyle of every part — and the
// vendored copy is exactly the kind of code that drifts on the next upgrade.

describe("getStateAttributesProps", () => {
  test("true becomes a valueless attribute", () => {
    expect(getStateAttributesProps({ open: true })).toEqual({ "data-open": "" });
  });

  test("falsy values are omitted entirely", () => {
    expect(getStateAttributesProps({ open: false, count: 0, label: "", missing: null })).toEqual(
      {},
    );
  });

  test("other values are stringified", () => {
    expect(getStateAttributesProps({ side: "left", count: 3 })).toEqual({
      "data-side": "left",
      "data-count": "3",
    });
  });

  test("keys are lowercased, not kebab-cased — hence the mapping escape hatch", () => {
    expect(getStateAttributesProps({ activationDirection: "left" })).toEqual({
      "data-activationdirection": "left",
    });
    expect(
      getStateAttributesProps(
        { activationDirection: "left" },
        { activationDirection: (value) => ({ "data-activation-direction": value }) },
      ),
    ).toEqual({ "data-activation-direction": "left" });
  });

  test("a mapping returning null drops the attribute but keeps the state field", () => {
    const state = { open: true, width: 240 };
    expect(getStateAttributesProps(state, { width: () => null })).toEqual({ "data-open": "" });
    expect(state.width).toBe(240);
  });

  test("a mapping may emit several attributes at once", () => {
    expect(
      getStateAttributesProps(
        { side: "left" },
        { side: (value) => ({ "data-side": value, "data-x": "1" }) },
      ),
    ).toEqual({ "data-side": "left", "data-x": "1" });
  });

  test("a mapping runs even for a falsy value, so both ends stay styleable", () => {
    const openClosed = (open: boolean): Record<string, string> =>
      open ? { "data-open": "" } : { "data-closed": "" };
    expect(getStateAttributesProps({ open: true }, { open: openClosed })).toEqual({
      "data-open": "",
    });
    expect(getStateAttributesProps({ open: false }, { open: openClosed })).toEqual({
      "data-closed": "",
    });
  });
});
