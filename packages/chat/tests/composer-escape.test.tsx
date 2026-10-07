import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { Composer } from "../src/composer";
import { isEscapeForComposer } from "../src/composer/store";
import { Tabs } from "../src/tabs";

// Escape stops a generating composer — but only an Escape that is the
// composer's to take. A page can hold several composers next to editors that
// are not composers at all, and the stop listener sits on the document.
//
// The roots here render a <div>, not the default <form>: happy-dom wraps every
// HTMLFormElement in a Proxy, so a form is never === its own node as seen from
// its children (closest() and contains() both disagree with it). Ownership is
// decided by node identity, which browsers keep and happy-dom does not.

const ChatComposer = ({
  name,
  generating = false,
  onStop,
}: {
  name: string;
  generating?: boolean;
  onStop?: () => void;
}) => (
  <Composer.Root onSubmit={() => {}} render={<div />}>
    <Composer.Textarea aria-label={name} />
    <Composer.Submit isGenerating={generating} onStop={onStop} />
  </Composer.Root>
);

const pressEscape = (target: Element | Document) =>
  act(() => void fireEvent.keyDown(target, { key: "Escape" }));

describe("Escape stops generation", () => {
  test("typed into the composer", () => {
    const onStop = mock();
    render(<ChatComposer name="Message" generating onStop={onStop} />);

    pressEscape(screen.getByRole("textbox", { name: "Message" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test("from nowhere in particular, after focus dropped to the body", () => {
    const onStop = mock();
    render(<ChatComposer name="Message" generating onStop={onStop} />);

    pressEscape(document.body);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  test("not while idle", () => {
    const onStop = mock();
    render(<ChatComposer name="Message" onStop={onStop} />);

    pressEscape(screen.getByRole("textbox", { name: "Message" }));
    expect(onStop).not.toHaveBeenCalled();
  });

  test("not when something already handled the key", () => {
    const onStop = mock();
    render(<ChatComposer name="Message" generating onStop={onStop} />);
    const claim = (event: Event) => event.preventDefault();
    const textbox = screen.getByRole("textbox", { name: "Message" });
    textbox.addEventListener("keydown", claim);

    pressEscape(textbox);
    textbox.removeEventListener("keydown", claim);
    expect(onStop).not.toHaveBeenCalled();
  });
});

describe("with more than one composer on the page", () => {
  test("an Escape typed into another composer is that composer's", () => {
    const onStop = mock();
    render(
      <>
        <ChatComposer name="Page" generating onStop={onStop} />
        <ChatComposer name="Popup" />
      </>,
    );

    pressEscape(screen.getByRole("textbox", { name: "Popup" }));
    expect(onStop).not.toHaveBeenCalled();
  });

  test("with both generating, the one typed into stops, not the one listening first", () => {
    const stopPage = mock();
    const stopPopup = mock();
    render(
      <>
        <ChatComposer name="Page" generating onStop={stopPage} />
        <ChatComposer name="Popup" generating onStop={stopPopup} />
      </>,
    );

    pressEscape(screen.getByRole("textbox", { name: "Popup" }));
    expect(stopPopup).toHaveBeenCalledTimes(1);
    expect(stopPage).not.toHaveBeenCalled();
  });

  test("an unclaimed Escape stops one generation per press", () => {
    const stopPage = mock();
    const stopPopup = mock();
    render(
      <>
        <ChatComposer name="Page" generating onStop={stopPage} />
        <ChatComposer name="Popup" generating onStop={stopPopup} />
      </>,
    );

    pressEscape(document.body);
    expect(stopPage.mock.calls.length + stopPopup.mock.calls.length).toBe(1);
  });
});

describe("next to editors that are not composers", () => {
  test("an Escape typed into an unrelated text field is that field's", () => {
    const onStop = mock();
    render(
      <>
        <ChatComposer name="Message" generating onStop={onStop} />
        <input aria-label="Title" />
        <div role="textbox" aria-label="Notes" contentEditable tabIndex={0} />
      </>,
    );

    pressEscape(screen.getByRole("textbox", { name: "Title" }));
    pressEscape(screen.getByRole("textbox", { name: "Notes" }));
    expect(onStop).not.toHaveBeenCalled();
  });

  test("an Escape on a plain button is nobody's in particular", () => {
    const onStop = mock();
    render(
      <>
        <ChatComposer name="Message" generating onStop={onStop} />
        <button type="button">Elsewhere</button>
      </>,
    );

    pressEscape(screen.getByRole("button", { name: "Elsewhere" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe("inside a floating Tabs.Popup", () => {
  // Stopping ends the generation, as a real chat's status would.
  const Dock = ({ onStop }: { onStop: () => void }) => {
    const [generating, setGenerating] = useState(true);
    const stop = () => {
      onStop();
      setGenerating(false);
    };
    return (
      <Tabs.Root defaultItems={["chat"]} defaultValue="chat">
        <Tabs.List>
          {(id) => (
            <Tabs.Trigger value={id} data-testid={`tab-${id}`}>
              {id}
            </Tabs.Trigger>
          )}
        </Tabs.List>
        <Tabs.Portal>
          <Tabs.Positioner>
            <Tabs.Popup>
              <Tabs.Viewport>
                {() => <ChatComposer name="Reply" generating={generating} onStop={stop} />}
              </Tabs.Viewport>
            </Tabs.Popup>
          </Tabs.Positioner>
        </Tabs.Portal>
      </Tabs.Root>
    );
  };

  test("the first Escape stops generating, the second closes the popup", async () => {
    const onStop = mock();
    const { getByTestId } = render(<Dock onStop={onStop} />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    const reply = screen.getByRole("textbox", { name: "Reply" });

    pressEscape(reply);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(getByTestId("tab-chat").getAttribute("aria-expanded")).toBe("true");

    pressEscape(reply);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(getByTestId("tab-chat").getAttribute("aria-expanded")).toBe("false");
  });
});

describe("isEscapeForComposer", () => {
  // Built by hand: a root with its editor, its options portaled out to the
  // body (as a positioned Composer.Panel does), and the same for a neighbour.
  const build = () => {
    const make = (html: string) => {
      const host = document.createElement("div");
      host.innerHTML = html;
      document.body.append(host);
      return host;
    };
    const ours = make('<div data-composer-root><div contenteditable="true"></div></div>');
    const theirs = make('<div data-composer-root><div contenteditable="true"></div></div>');
    const ourOptions = make('<div data-ask-user-options><button type="button"></button></div>');
    const theirOptions = make('<div data-ask-user-options><button type="button"></button></div>');
    const field = make("<textarea></textarea>");
    const root = ours.querySelector<HTMLElement>("[data-composer-root]");
    const options = ourOptions.querySelector<HTMLElement>("[data-ask-user-options]");
    const cleanup = () => {
      for (const host of [ours, theirs, ourOptions, theirOptions, field]) host.remove();
    };
    const keyFrom = (element: Element | null) => {
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
      let decided: boolean | undefined;
      const listen = (heard: Event) => {
        decided = isEscapeForComposer(heard as KeyboardEvent, root, options);
      };
      document.addEventListener("keydown", listen);
      element?.dispatchEvent(event);
      document.removeEventListener("keydown", listen);
      return decided;
    };
    return { ours, theirs, ourOptions, theirOptions, field, keyFrom, cleanup };
  };

  test("ours: our root, our options wherever they render, and unclaimed targets", () => {
    const dom = build();
    expect(dom.keyFrom(dom.ours.querySelector("[contenteditable]"))).toBe(true);
    expect(dom.keyFrom(dom.ourOptions.querySelector("button"))).toBe(true);
    expect(dom.keyFrom(document.body)).toBe(true);
    dom.cleanup();
  });

  test("theirs: another composer, its options, any other text field", () => {
    const dom = build();
    expect(dom.keyFrom(dom.theirs.querySelector("[contenteditable]"))).toBe(false);
    expect(dom.keyFrom(dom.theirOptions.querySelector("button"))).toBe(false);
    expect(dom.keyFrom(dom.field.querySelector("textarea"))).toBe(false);
    dom.cleanup();
  });
});
