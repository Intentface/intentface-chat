// bun test preload — registers a happy-dom global environment so the a11y
// test layer can render primitives and assert on the accessibility tree.
// The pure suites (segments, tracker, machines, …) don't touch the globals.

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

// React Testing Library drives updates through act(); this flag tells React
// the environment is act-aware, silencing spurious warnings.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
