// bun test preload — registers a happy-dom global environment so the a11y
// test layer can render primitives and assert on the accessibility tree.
// The pure suites (segments, tracker, machines, …) don't touch the globals.

import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A real origin, not the default about:blank — document.cookie is silently
// dropped without one, and the shell/nav/tabs cookie storage is a thing we test.
GlobalRegistrator.register({ url: "http://localhost" });

// React Testing Library drives updates through act(); this flag tells React
// the environment is act-aware, silencing spurious warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// RTL only auto-registers its own afterEach when it recognises the test
// runner's globals, which it does not under bun — without this, every render
// stacks up in the same document and queries start matching several nodes.
// Imported dynamically so it resolves after the DOM globals exist.
const { cleanup } = await import("@testing-library/react");
const { afterEach } = await import("bun:test");

afterEach(cleanup);
