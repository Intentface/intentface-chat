import { describe, expect, test } from "bun:test";
import { render as renderToDom } from "@testing-library/react";
import type { Ref } from "react";
import type { PrimitiveProps } from "../src/internal/primitive-props";
import { useRenderElement } from "../src/internal/render/useRenderElement";

// Coverage for the vendored render machinery every part is built on: the `render` prop, state
// published as data-*, className/style as functions of state, and the three-way ref merge.
// The vendored copy has no upstream tests here, so this is what would catch a drift on the
// next Base UI sync.

type DemoState = { open: boolean; side: string };

const DEFAULT_STATE: DemoState = { open: true, side: "left" };

/** A stand-in part: one internal class, one internal handler, one internal ref. */
const Demo = ({
  state = DEFAULT_STATE,
  internalRef,
  onInternalClick,
  className,
  render,
  style,
  ...elementProps
}: PrimitiveProps<"div", DemoState> & {
  state?: DemoState;
  internalRef?: Ref<HTMLElement>;
  onInternalClick?: () => void;
}) =>
  useRenderElement(
    "div",
    { className, render, style },
    {
      state,
      ref: internalRef,
      props: [{ className: "part", "data-testid": "demo", onClick: onInternalClick }, elementProps],
    },
  );

describe("useRenderElement", () => {
  test("renders the default element with state as data-attributes", () => {
    const { getByTestId } = renderToDom(<Demo />);
    const node = getByTestId("demo");

    expect(node.tagName).toBe("DIV");
    expect(node.getAttribute("data-open")).toBe("");
    expect(node.getAttribute("data-side")).toBe("left");
  });

  test("falsy state is omitted rather than rendered as a string", () => {
    const { getByTestId } = renderToDom(<Demo state={{ open: false, side: "left" }} />);
    expect(getByTestId("demo").hasAttribute("data-open")).toBe(false);
  });

  // The consumer's class is emitted first, not last. Attribute order has no bearing on the
  // cascade, so this pins the vendored behaviour rather than asserting a preference.
  test("both the part's and the consumer's classes land on the element", () => {
    const { getByTestId } = renderToDom(<Demo className="mine" />);

    expect(getByTestId("demo").getAttribute("class")).toBe("mine part");
  });

  test("className and style may be functions of state", () => {
    const { getByTestId } = renderToDom(
      <Demo
        className={(state) => (state.open ? "is-open" : "is-closed")}
        style={(state) => ({ width: state.open ? "240px" : "0px" })}
      />,
    );
    const node = getByTestId("demo");

    expect(node.getAttribute("class")).toContain("is-open");
    expect(node.style.width).toBe("240px");
  });

  test("render as an element swaps the tag and keeps the part's own state", () => {
    const { getByTestId } = renderToDom(
      <Demo
        className="mine"
        render={
          <a href="/chat" className="link">
            Chat
          </a>
        }
      />,
    );
    const node = getByTestId("demo");

    expect(node.tagName).toBe("A");
    expect(node.getAttribute("href")).toBe("/chat");
    expect(node.getAttribute("class")).toBe("link mine part");
    expect(node.getAttribute("data-open")).toBe("");
  });

  test("render as a callback receives the resolved props and the state", () => {
    const { getByTestId } = renderToDom(
      <Demo
        render={(props, state) => <button type="button" {...props} disabled={!state.open} />}
      />,
    );
    const node = getByTestId("demo");

    expect(node.tagName).toBe("BUTTON");
    expect((node as HTMLButtonElement).disabled).toBe(false);
    expect(node.getAttribute("data-side")).toBe("left");
  });

  test("internal, consumer and render-element refs all receive the node", () => {
    const internal: { current: HTMLElement | null } = { current: null };
    // Div-typed because the part declares "div" — `render` swapping the tag doesn't change
    // the declared ref type, which is exactly how this behaves for a real consumer.
    const consumer: { current: HTMLDivElement | null } = { current: null };
    // Written through a callback ref rather than handed over as an object one,
    // so the other branch of the merge is covered too.
    const fromRenderElement: { current: HTMLElement | null } = { current: null };

    const { getByTestId } = renderToDom(
      <Demo
        internalRef={internal}
        ref={consumer}
        render={
          <a
            href="/x"
            ref={(element) => {
              fromRenderElement.current = element;
            }}
          >
            Go
          </a>
        }
      />,
    );
    const node = getByTestId("demo");

    expect(internal.current).toBe(node);
    expect(consumer.current).toBe(node as HTMLDivElement);
    expect(fromRenderElement.current).toBe(node);
  });

  test("refs are detached on unmount", () => {
    const consumer: { current: HTMLDivElement | null } = { current: null };
    const { unmount } = renderToDom(<Demo ref={consumer} />);

    expect(consumer.current).not.toBeNull();
    unmount();
    expect(consumer.current).toBeNull();
  });

  test("the part's handler and the consumer's both fire, consumer first", () => {
    const order: string[] = [];
    const { getByTestId } = renderToDom(
      <Demo onInternalClick={() => order.push("part")} onClick={() => order.push("consumer")} />,
    );

    getByTestId("demo").click();
    expect(order).toEqual(["consumer", "part"]);
  });
});
