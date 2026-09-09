import { describe, expect, spyOn, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useControlled } from "../src/internal/use-controlled";

const setup = (controlled?: string) =>
  renderHook(
    ({ value }: { value: string | undefined }) =>
      useControlled({ controlled: value, default: "default", name: "Test" }),
    { initialProps: { value: controlled } },
  );

describe("useControlled", () => {
  test("uncontrolled: starts at the default and the setter updates it", () => {
    const { result } = setup();
    expect(result.current[0]).toBe("default");

    act(() => result.current[1]("next"));
    expect(result.current[0]).toBe("next");
  });

  test("controlled: reports the prop and ignores the setter", () => {
    const { result } = setup("theirs");
    expect(result.current[0]).toBe("theirs");

    act(() => result.current[1]("ignored"));
    expect(result.current[0]).toBe("theirs");
  });

  test("controlled: follows the prop across rerenders", () => {
    const { result, rerender } = setup("first");
    rerender({ value: "second" });
    expect(result.current[0]).toBe("second");
  });

  test("the setter's identity is stable across renders", () => {
    const { result, rerender } = setup();
    const first = result.current[1];
    rerender({ value: undefined });
    expect(result.current[1]).toBe(first);
  });

  test("warns, without throwing, when a component flips controlled-ness", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    try {
      const { result, rerender } = setup();
      rerender({ value: "now-controlled" });

      expect(error).toHaveBeenCalled();
      // Latched at first render, so it stays uncontrolled rather than
      // silently handing control over mid-life.
      expect(result.current[0]).toBe("default");
    } finally {
      error.mockRestore();
    }
  });
});
