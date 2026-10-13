import { afterEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { Composer } from "../src/composer";

// Portaled parts must hydrate cleanly: the server can't render a portal, so the
// first client render must match its empty output, then portal (CHAT-50).

const App = () => (
  <Composer.Root onSubmit={() => {}}>
    <Composer.Panel>
      <p>panel</p>
    </Composer.Panel>
    <Composer.Popover>
      <p>popover</p>
    </Composer.Popover>
    <Composer.Container>
      <Composer.Textarea aria-label="Message" />
    </Composer.Container>
  </Composer.Root>
);

describe("portaled parts", () => {
  let root: Root | null = null;
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  test("server-render nothing, hydrate without a mismatch, then portal into the body", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<App />);
    document.body.append(container);
    expect(container.querySelector("[data-composer-panel], [data-composer-popover]")).toBeNull();

    const errors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, <App />, { onRecoverableError: (error) => errors.push(error) });
    });

    expect(errors).toEqual([]);
    expect(document.querySelector("body > [data-composer-panel]")?.textContent).toBe("panel");
    expect(document.querySelector("body > [data-composer-popover]")?.textContent).toBe("popover");
  });
});
