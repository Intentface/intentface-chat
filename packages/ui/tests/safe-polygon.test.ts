import { describe, expect, mock, test } from "bun:test";
import { createSafePolygon, type Side } from "../src/internal/safe-polygon";

const box = (x: number, y: number, width: number, height: number) => {
  const element = document.createElement("div");
  element.getBoundingClientRect = () =>
    ({ x, y, width, height, top: y, left: x, right: x + width, bottom: y + height }) as DOMRect;
  document.body.append(element);
  return element;
};

const move = (clientX: number, clientY: number) =>
  new MouseEvent("mousemove", { clientX, clientY });

const cone = (side: Side, from: [number, number], reference: Element, floating: Element) => {
  const onClose = mock(() => {});
  const { onMouseMove: listener, stop } = createSafePolygon({
    x: from[0],
    y: from[1],
    side,
    reference,
    floating,
    onClose,
  });
  return { listener, stop, onClose };
};

describe("createSafePolygon", () => {
  test("below: the gap between the tab and the popup is safe, and wandering off is not", () => {
    const { listener, onClose } = cone(
      "bottom",
      [50, 30],
      box(0, 0, 100, 30),
      box(0, 40, 200, 200),
    );

    listener(move(52, 35));
    expect(onClose).not.toHaveBeenCalled();

    listener(move(600, 10));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("to the right: the gap is safe, and leaving from the far side closes at once", () => {
    const reference = box(0, 0, 100, 30);
    const floating = box(110, 0, 200, 200);
    const towards = cone("right", [100, 15], reference, floating);

    towards.listener(move(105, 15));
    expect(towards.onClose).not.toHaveBeenCalled();

    const away = cone("right", [0, 15], reference, floating);
    away.listener(move(-5, 15));
    expect(away.onClose).toHaveBeenCalledTimes(1);
  });

  test("stopping the cone cancels a check still waiting for the mouse to land", async () => {
    const reference = box(0, 0, 100, 30);
    const { listener, stop, onClose } = cone("bottom", [50, 30], reference, box(0, 100, 300, 200));

    // Inside the cone but not yet landed, so the close is only scheduled.
    listener(move(150, 60));
    stop();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(onClose).not.toHaveBeenCalled();
  });
});
