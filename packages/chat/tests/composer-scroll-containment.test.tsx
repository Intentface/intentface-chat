import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { AskUser } from "../src/ask-user";
import { Composer } from "../src/composer";
import { scrollCaretIntoView } from "../src/composer/editor-dom";
import { useComposer } from "../src/composer/store";
import type { AskUserQuestion } from "../src/composer/types";
import { scrollIntoViewWithin } from "../src/internal/scroll-into-view-within";

// A composer embedded in a scrolling page scrolls only its own scroll areas:
// programmatic writes and the ask-user flow's focus moves must leave the page
// where it is (CHAT-42).

// happy-dom has no layout, so each element gets a stubbed box.
type Box = { top: number; height: number; scrollHeight?: number };

const place = (element: HTMLElement, { top, height, scrollHeight = height }: Box) => {
  element.getBoundingClientRect = () =>
    ({ top, bottom: top + height, height, left: 0, right: 0, width: 0 }) as DOMRect;
  Object.defineProperty(element, "clientHeight", { value: height, configurable: true });
  Object.defineProperty(element, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(element, "scrollTop", { value: 0, writable: true, configurable: true });
};

// page (scrolls) > composer root > text area (may scroll) > editor
const embeddedComposer = ({ textAreaOverflows }: { textAreaOverflows: boolean }) => {
  const page = document.createElement("div");
  const composer = document.createElement("div");
  const textArea = document.createElement("div");
  const editor = document.createElement("div");
  page.style.overflowY = "auto";
  textArea.style.overflowY = "auto";
  composer.setAttribute("data-composer-root", "");
  page.append(composer);
  composer.append(textArea);
  textArea.append(editor);
  document.body.append(page);

  place(page, { top: 100, height: 600, scrollHeight: 2000 });
  place(composer, { top: 400, height: 140 });
  place(textArea, { top: 410, height: 100, scrollHeight: textAreaOverflows ? 400 : 100 });
  place(editor, { top: 410, height: textAreaOverflows ? 400 : 100 });
  return { page, textArea, editor };
};

const rectOf = (rect: Partial<DOMRect>) =>
  ({ top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0, ...rect }) as DOMRect;

// The selection's collapsed range: its own box, and the DOM point it sits at.
const caretAt = (
  rect: Partial<DOMRect>,
  point: { container: Node; offset: number } = { container: document.body, offset: 0 },
) => {
  const range = {
    getBoundingClientRect: () => rectOf(rect),
    startContainer: point.container,
    startOffset: point.offset,
  };
  document.getSelection = () => ({ rangeCount: 1, getRangeAt: () => range }) as never;
};

describe("scrollCaretIntoView", () => {
  const getSelection = document.getSelection.bind(document);
  const createRange = document.createRange.bind(document);
  afterEach(() => {
    document.getSelection = getSelection;
    document.createRange = createRange;
    document.body.innerHTML = "";
  });

  test("a caret with no box and no line to measure scrolls nothing", () => {
    const { page, textArea, editor } = embeddedComposer({ textAreaOverflows: false });
    caretAt({ top: 0, bottom: 0, height: 0 }, { container: editor, offset: 0 });
    scrollCaretIntoView(editor);
    expect(page.scrollTop).toBe(0);
    expect(textArea.scrollTop).toBe(0);
  });

  test("the walk stops at the composer: a caret outside the page's view leaves the page alone", () => {
    const { page, editor } = embeddedComposer({ textAreaOverflows: false });
    caretAt({ top: 40, bottom: 60, height: 20 });
    scrollCaretIntoView(editor);
    expect(page.scrollTop).toBe(0);
  });

  test("a caret on an empty last line is measured by its <br> and scrolled into view", () => {
    const { page, textArea, editor } = embeddedComposer({ textAreaOverflows: true });
    // "text\n" renders as text, a line break, and the padding break that gives
    // the empty last line its box. The caret sits before that padding break.
    editor.append("text", document.createElement("br"), document.createElement("br"));
    caretAt({ top: 0, bottom: 0, height: 0 }, { container: editor, offset: 2 });
    let measured = null as Node | null;
    document.createRange = () =>
      ({
        selectNode: (node: Node) => {
          measured = node;
        },
        getBoundingClientRect: () => rectOf({ top: 530, bottom: 550, height: 20 }),
      }) as never;
    scrollCaretIntoView(editor);
    expect(measured).toBe(editor.childNodes[2] as Node);
    expect(textArea.scrollTop).toBe(40);
    expect(page.scrollTop).toBe(0);
  });

  test("overflowing text scrolls the caret into view inside the composer's own text area", () => {
    const { page, textArea, editor } = embeddedComposer({ textAreaOverflows: true });
    caretAt({ top: 530, bottom: 550, height: 20 });
    scrollCaretIntoView(editor);
    expect(textArea.scrollTop).toBe(40);
    expect(page.scrollTop).toBe(0);
  });
});

describe("scrollIntoViewWithin", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("the boundary itself may scroll", () => {
    const { textArea, editor } = embeddedComposer({ textAreaOverflows: true });
    scrollIntoViewWithin({ top: 380, bottom: 400, height: 20 } as DOMRect, editor, textArea);
    expect(textArea.scrollTop).toBe(-30);
  });

  test("an element with no scrollable ancestor inside the boundary scrolls nothing", () => {
    const { page, editor } = embeddedComposer({ textAreaOverflows: false });
    scrollIntoViewWithin({ top: 0, bottom: 20, height: 20 } as DOMRect, editor, editor);
    expect(page.scrollTop).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The ask-user flow's own focus moves
// ---------------------------------------------------------------------------

const QUESTIONS: AskUserQuestion[] = [
  { question: "Which database?", options: [{ label: "PostgreSQL" }, { label: "SQLite" }] },
];

const AskUserOptions = () => {
  const askUser = useComposer((composer) => composer.askUser);
  const question = askUser.questions?.[askUser.step];
  if (!question) return null;
  return (
    <AskUser.Root>
      <AskUser.Options ref={askUser.optionsRef}>
        {question.options.map((option) => (
          <AskUser.Option
            key={option.label}
            value={option.label}
            onSelect={() => askUser.toggleOption(option.label)}
          >
            {option.label}
          </AskUser.Option>
        ))}
      </AskUser.Options>
    </AskUser.Root>
  );
};

// activateAskUser moves focus into the options one frame past the commit.
const flushFrames = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

describe("ask-user focus moves keep the page in place", () => {
  const focus = HTMLElement.prototype.focus;
  let calls: { element: HTMLElement; options?: FocusOptions }[] = [];

  beforeEach(() => {
    calls = [];
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      calls.push({ element: this, options });
      focus.call(this, options);
    };
  });

  afterEach(() => {
    HTMLElement.prototype.focus = focus;
  });

  const renderQuestion = async () => {
    render(
      <Composer.Root questions={QUESTIONS} onSubmit={() => {}}>
        <Composer.Textarea aria-label="Message" />
        <AskUserOptions />
      </Composer.Root>,
    );
    await flushFrames();
  };

  const focusesOf = (element: HTMLElement) => calls.filter((call) => call.element === element);

  test("focus moves into the first option without scrolling", async () => {
    await renderQuestion();
    const first = screen.getByRole("radio", { name: "PostgreSQL" });
    expect(focusesOf(first).at(-1)?.options).toEqual({ preventScroll: true });
  });

  test("arrowing between options does not scroll", async () => {
    await renderQuestion();
    act(
      () => void fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" }),
    );
    const second = screen.getByRole("radio", { name: "SQLite" });
    expect(document.activeElement).toBe(second);
    expect(focusesOf(second).at(-1)?.options).toEqual({ preventScroll: true });
  });

  test("typing to answer moves focus back to the input without scrolling", async () => {
    await renderQuestion();
    act(() => void fireEvent.keyDown(document.activeElement ?? document.body, { key: "a" }));
    const input = screen.getByRole("textbox", { name: "Message" });
    expect(document.activeElement).toBe(input);
    expect(focusesOf(input).at(-1)?.options).toEqual({ preventScroll: true });
  });
});
