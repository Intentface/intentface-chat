import assert from "node:assert/strict";
import { glob, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildShadcnDist } from "../scripts/build-shadcn-dist.mjs";
import {
  addItems,
  detectPackageManager,
  getInstallPlan,
  inferConfig,
  loadRegistry,
  resolveRegistrySelection,
  resolveTargetPath,
  rewriteInternalImports,
  upsertIntentfaceCssBlock,
} from "../src/index.js";

test("every manifest sourcePath exists on disk", async () => {
  const manifestPath = fileURLToPath(new URL("../registry/manifest.json", import.meta.url));
  const repoRoot = path.resolve(path.dirname(manifestPath), "..", "..", "..");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const item of manifest.items) {
    for (const file of item.files ?? []) {
      if (file.sourcePath.includes("*")) {
        const matches = await Array.fromAsync(glob(file.sourcePath, { cwd: repoRoot }));
        assert.ok(matches.length > 0, `${item.name}: glob "${file.sourcePath}" matched no files`);
        continue;
      }
      await assert.doesNotReject(
        stat(path.join(repoRoot, file.sourcePath)),
        `${item.name}: sourcePath "${file.sourcePath}" does not exist`,
      );
    }
  }
});

test("shadcn dist maps items, hides unlisted, rewrites deps to URLs", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "intentface-dist-"));
  try {
    const expandedItems = [
      {
        name: "widget",
        type: "registry:component",
        title: "Widget",
        dependencies: ["@intentface/chat"],
        registryDependencies: ["utils"],
        files: [
          {
            sourcePath: "components/ai/widget.tsx",
            targetPath: "components/ai/widget.tsx",
            type: "registry:component",
            content: "export const Widget = () => null;\n",
          },
        ],
      },
      {
        name: "utils",
        type: "registry:lib",
        hidden: true,
        files: [
          {
            sourcePath: "lib/utils.ts",
            targetPath: "lib/utils.ts",
            type: "registry:lib",
            content: "export const cn = () => '';\n",
          },
        ],
      },
      {
        name: "bundle",
        type: "registry:bundle",
        title: "Bundle",
        registryDependencies: ["widget"],
        exampleDependencies: ["widget"],
      },
      {
        name: "theme-file",
        type: "registry:item",
        title: "Theme file",
        files: [
          {
            sourcePath: "packages/intentface/registry/intentface.css",
            targetPath: "~/app/intentface.css",
            type: "registry:file",
            content: ":root { --bg: #fff; }\n",
          },
        ],
      },
      {
        name: "theme",
        type: "registry:theme",
        hidden: true,
        cssBlocks: [
          {
            name: "theme",
            content: [
              '@source "../node_modules/streamdown/dist/*.js";',
              "@custom-variant dark (&:is(.dark *));",
              ":root { --bg: #fff; --mix: calc(16% * var(--con)); font-feature-settings: 'liga' 1; }",
              ".dark { --bg: #111; }",
              "@theme inline { --color-base: var(--base); }",
            ].join("\n"),
          },
        ],
      },
    ];

    await buildShadcnDist({
      manifest: { name: "intentface", homepage: "https://intentface.dev" },
      expandedItems,
      outputDir,
      baseUrl: "http://localhost:4141",
    });

    const index = JSON.parse(await readFile(path.join(outputDir, "registry.json"), "utf8"));
    assert.deepEqual(
      index.items.map((item) => item.name),
      ["widget", "bundle", "theme-file"],
    );
    assert.ok(index.items.every((item) => (item.files ?? []).every((file) => !file.content)));

    const widget = JSON.parse(await readFile(path.join(outputDir, "widget.json"), "utf8"));
    assert.equal(widget.$schema, "https://ui.shadcn.com/schema/registry-item.json");
    assert.equal(widget.type, "registry:component");
    assert.deepEqual(widget.registryDependencies, ["http://localhost:4141/r/utils.json"]);
    assert.equal(widget.files[0].path, "components/ai/widget.tsx");
    assert.equal(widget.files[0].target, "components/ai/widget.tsx");
    assert.ok(widget.files[0].content.includes("Widget"));
    assert.equal(widget.exampleDependencies, undefined);
    assert.equal(widget.hidden, undefined);

    // Hidden items are still emitted so transitive URL deps resolve.
    const utils = JSON.parse(await readFile(path.join(outputDir, "utils.json"), "utf8"));
    assert.equal(utils.name, "utils");

    const bundle = JSON.parse(await readFile(path.join(outputDir, "bundle.json"), "utf8"));
    assert.equal(bundle.type, "registry:block");
    assert.equal(bundle.files, undefined);

    // registry:file items keep their root-relative "~/" target and carry content.
    const themeFile = JSON.parse(await readFile(path.join(outputDir, "theme-file.json"), "utf8"));
    assert.equal(themeFile.type, "registry:item");
    assert.equal(themeFile.files[0].type, "registry:file");
    assert.equal(themeFile.files[0].target, "~/app/intentface.css");
    assert.ok(themeFile.files[0].content.includes("--bg"));

    const theme = JSON.parse(await readFile(path.join(outputDir, "theme.json"), "utf8"));
    assert.equal(theme.cssVars.light.bg, "#fff");
    assert.equal(theme.cssVars.light.mix, "calc(16% * var(--con))");
    assert.equal(theme.cssVars.dark.bg, "#111");
    assert.equal(theme.cssVars.theme["color-base"], "var(--base)");
    assert.deepEqual(theme.css["@custom-variant dark (&:is(.dark *))"], {});
    assert.deepEqual(theme.css['@source "../node_modules/streamdown/dist/*.js"'], {});
    assert.equal(theme.css[":root"]["font-feature-settings"], "'liga' 1");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("registry resolves transitive dependencies for a named AI primitive", async () => {
  const registry = await loadRegistry();
  const items = resolveRegistrySelection(registry, ["message"]);
  const names = items.map((item) => item.name);

  assert.ok(names.includes("message"));
  assert.ok(names.includes("markdown"));
  assert.ok(names.includes("tooltip"));
  assert.ok(names.includes("hooks-use-copy"));
  assert.ok(names.includes("icons"));

  const plan = getInstallPlan(items);
  assert.ok(plan.files.some((file) => file.targetPath === "components/ai/message.tsx"));
  assert.ok(plan.dependencies.includes("@intentface/chat"));
});

test("import rewriting uses target aliases when configured", () => {
  const result = rewriteInternalImports({
    content: 'import Button from "@/components/ui/button";\nimport { cn } from "@/lib/utils";\n',
    sourcePath: "components/ai/example.tsx",
    targetPath: "components/ai/example.tsx",
    sourceToTarget: {
      "components/ai/example.tsx": "components/ai/example.tsx",
      "components/ui/button.tsx": "components/ui/button.tsx",
      "lib/utils.ts": "lib/utils.ts",
    },
    config: {
      aliases: {
        ui: "~/ui",
        utils: "~/lib/utils",
      },
    },
  });

  assert.equal(result, 'import Button from "~/ui/button";\nimport { cn } from "~/lib/utils";\n');
});

test("import rewriting falls back to relative imports without aliases", () => {
  const result = rewriteInternalImports({
    content: 'import { cn } from "@/lib/utils";\n',
    sourcePath: "components/ui/button.tsx",
    targetPath: "components/ui/button.tsx",
    sourceToTarget: {
      "components/ui/button.tsx": "components/ui/button.tsx",
      "lib/utils.ts": "lib/utils.ts",
    },
    config: { aliases: {} },
  });

  assert.equal(result, 'import { cn } from "../../lib/utils";\n');
});

test("src-layout targets keep alias imports but write under src", () => {
  const config = inferConfig({
    tsconfig: {
      compilerOptions: {
        paths: {
          "@/*": ["./src/*"],
        },
      },
    },
  });

  const buttonTarget = resolveTargetPath("components/ui/button.tsx", config);
  assert.equal(buttonTarget, "src/components/ui/button.tsx");

  const result = rewriteInternalImports({
    content: 'import { cn } from "@/lib/utils";\n',
    sourcePath: "components/ui/button.tsx",
    targetPath: buttonTarget,
    sourceToTarget: {
      "components/ui/button.tsx": buttonTarget,
      "lib/utils.ts": resolveTargetPath("lib/utils.ts", config),
    },
    config,
  });

  assert.equal(result, 'import { cn } from "@/lib/utils";\n');
});

test("css block insertion is idempotent", () => {
  const first = upsertIntentfaceCssBlock('@import "tailwindcss";\n', ":root { --bg: #fff; }");
  const second = upsertIntentfaceCssBlock(first, ":root { --bg: #000; }");

  assert.equal(second.match(/intentface:start/g)?.length, 1);
  assert.ok(second.includes("--bg: #000"));
  assert.ok(!second.includes("--bg: #fff"));
});

test("css source paths are rewritten relative to nested globals files", () => {
  const result = upsertIntentfaceCssBlock(
    '@import "tailwindcss";\n',
    '@source "../node_modules/streamdown/dist/*.js";',
    { cssPath: "src/app/globals.css" },
  );

  assert.ok(result.includes('@source "../../node_modules/streamdown/dist/*.js";'));
});

test("package manager detection follows lockfile priority", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "intentface-pm-"));
  try {
    assert.equal(await detectPackageManager(dir), "npm");
    await writeFile(path.join(dir, "yarn.lock"), "");
    assert.equal(await detectPackageManager(dir), "yarn");
    await writeFile(path.join(dir, "pnpm-lock.yaml"), "");
    assert.equal(await detectPackageManager(dir), "pnpm");
    await writeFile(path.join(dir, "bun.lock"), "");
    assert.equal(await detectPackageManager(dir), "bun");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("config inference reuses shadcn aliases and css path", () => {
  const config = inferConfig({
    shadcnConfig: {
      tailwind: { css: "src/app/globals.css" },
      aliases: {
        components: "~/components",
        ui: "~/components/ui",
        utils: "~/lib/utils",
      },
    },
    tsconfig: null,
  });

  assert.equal(config.tailwind.css, "src/app/globals.css");
  assert.equal(config.aliases.ui, "~/components/ui");
  assert.equal(config.aliases.ai, "@/components/ai");
});

test("config inference detects src source root from tsconfig aliases", () => {
  const config = inferConfig({
    tsconfig: {
      compilerOptions: {
        paths: {
          "@/*": ["src/*"],
        },
      },
    },
  });

  assert.equal(config.sourceRoot, "src");
  assert.equal(config.aliases.components, "@/components");
});

test("dry-run add resolves files without mutating a fixture project", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "intentface-fixture-"));
  try {
    await mkdir(path.join(dir, "app"), { recursive: true });
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        dependencies: {
          next: "16.0.0",
          react: "19.0.0",
          tailwindcss: "4.0.0",
        },
      }),
    );
    await writeFile(
      path.join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          paths: {
            "@/*": ["./*"],
          },
        },
      }),
    );
    await writeFile(path.join(dir, "app/globals.css"), '@import "tailwindcss";\n');

    await addItems(["button", "message"], {
      cwd: dir,
      dryRun: true,
      yes: true,
    });

    await assert.rejects(readFile(path.join(dir, "components/ui/button.tsx"), "utf8"), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
