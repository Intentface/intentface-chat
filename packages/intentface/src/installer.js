import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";
import { upsertIntentfaceCssBlock } from "./css.js";
import { pathExists, readJson, writeJson, writeText } from "./fs-utils.js";
import { resolveTargetPath, rewriteInternalImports } from "./imports.js";
import { detectPackageManager, getInstallCommand, packageNameFromSpec } from "./package-manager.js";
import {
  assertCompatibleProject,
  findGlobalCssPath,
  getExistingDependencies,
  loadProject,
} from "./project.js";
import { getInstallPlan, loadRegistry, resolveRegistrySelection } from "./registry.js";

export const initProject = async (options = {}) => {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const registry = await loadRegistry();
  const project = await loadProject(cwd);
  await assertCompatibleProject(project);

  const cssPath = await findGlobalCssPath(cwd, project.config);
  const config = {
    ...project.config,
    tailwind: {
      ...project.config.tailwind,
      css: cssPath,
    },
  };

  const items = resolveRegistrySelection(registry, ["utils", "intentface-theme"]);
  const plan = getInstallPlan(items);

  if (!options.dryRun) {
    await writeJson(project.configPath, config);
  }

  await applyInstallPlan({
    cwd,
    registry,
    project: { ...project, config },
    plan,
    options,
  });

  return { config, plan };
};

export const addItems = async (names, options = {}) => {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const registry = await loadRegistry();
  const project = await loadProject(cwd);
  await assertCompatibleProject(project);

  const items = resolveRegistrySelection(registry, names, {
    includeExamples: options.example,
  });
  const plan = getInstallPlan(items);

  await applyInstallPlan({ cwd, registry, project, plan, options });
  return { plan };
};

export const applyInstallPlan = async ({ cwd, registry, project, plan, options = {} }) => {
  const sourceToTarget = Object.fromEntries(
    plan.files.map((file) => [file.sourcePath, resolveTargetPath(file.targetPath, project.config)]),
  );
  const writes = [];

  for (const file of plan.files) {
    const content = rewriteInternalImports({
      content: file.content,
      sourcePath: file.sourcePath,
      targetPath: sourceToTarget[file.sourcePath],
      sourceToTarget,
      config: project.config,
    });
    writes.push({ targetPath: sourceToTarget[file.sourcePath], content });
  }

  const cssPath = await findGlobalCssPath(cwd, project.config);
  for (const block of plan.cssBlocks) {
    const targetPath = block.targetPath ?? cssPath;
    const fullPath = path.join(cwd, targetPath);
    const existing = (await pathExists(fullPath))
      ? await readFile(fullPath, "utf8")
      : '@import "tailwindcss";\n';
    writes.push({
      targetPath,
      content: upsertIntentfaceCssBlock(existing, block.content, {
        cssPath: targetPath,
      }),
      merge: true,
    });
  }

  const installedFiles = [];
  for (const write of writes) {
    const decision = write.merge ? "write" : await resolveConflict(cwd, write.targetPath, options);
    if (decision === "skip") continue;

    if (options.dryRun) {
      installedFiles.push(toInstalledFile(write.targetPath, write.content));
      continue;
    }

    await writeText(path.join(cwd, write.targetPath), write.content);
    installedFiles.push(toInstalledFile(write.targetPath, write.content));
  }

  await installMissingDependencies({
    cwd,
    packageJson: project.packageJson,
    dependencies: plan.dependencies,
    devDependencies: plan.devDependencies,
    options,
  });

  if (!options.dryRun) {
    await updateInstalledManifest(cwd, registry.version, plan, installedFiles);
  }

  printPlan({ plan, installedFiles, dryRun: options.dryRun });
};

const resolveConflict = async (cwd, targetPath, options) => {
  if (!(await pathExists(path.join(cwd, targetPath)))) return "write";
  if (options.overwrite || options.yes) return "write";
  if (options.skipExisting || !input.isTTY) return "skip";

  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(`${targetPath} already exists. Overwrite? [y/N] `);
    return answer.trim().toLowerCase().startsWith("y") ? "write" : "skip";
  } finally {
    rl.close();
  }
};

const installMissingDependencies = async ({
  cwd,
  packageJson,
  dependencies,
  devDependencies,
  options,
}) => {
  const existing = getExistingDependencies(packageJson);
  const missingDeps = dependencies.filter(
    (dependency) => !existing[packageNameFromSpec(dependency)],
  );
  const missingDevDeps = devDependencies.filter(
    (dependency) => !existing[packageNameFromSpec(dependency)],
  );
  if (missingDeps.length === 0 && missingDevDeps.length === 0) return;

  const manager = await detectPackageManager(cwd);
  const commands = [
    getInstallCommand(manager, missingDeps),
    getInstallCommand(manager, missingDevDeps, { dev: true }),
  ].filter(Boolean);
  if (commands.length === 0) return;

  if (options.dryRun) {
    for (const command of commands) {
      console.log(`Would install dependencies: ${command.command} ${command.args.join(" ")}`);
    }
    return;
  }

  if (!options.yes && input.isTTY) {
    const rl = readline.createInterface({ input, output });
    try {
      const answer = await rl.question(`Install dependencies with ${manager}? [Y/n] `);
      if (answer.trim().toLowerCase().startsWith("n")) return;
    } finally {
      rl.close();
    }
  }

  for (const command of commands) {
    await runInstallCommand(command, cwd);
  }
};

const runInstallCommand = (command, cwd) =>
  new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, {
      cwd,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Dependency installation failed with exit code ${code}`));
    });
  });

const updateInstalledManifest = async (cwd, registryVersion, plan, files) => {
  const manifestPath = path.join(cwd, ".intentface", "installed.json");
  const current = (await readJson(manifestPath)) ?? {
    registryVersion,
    items: {},
    files: {},
  };

  current.registryVersion = registryVersion;
  current.updatedAt = new Date().toISOString();
  for (const item of plan.items) {
    current.items[item.name] = item;
  }
  for (const file of files) {
    current.files[file.path] = file;
  }

  await writeJson(manifestPath, current);
};

const toInstalledFile = (targetPath, content) => ({
  path: targetPath,
  hash: createHash("sha256").update(content).digest("hex"),
});

const printPlan = ({ plan, installedFiles, dryRun }) => {
  const verb = dryRun ? "Would write" : "Wrote";
  if (installedFiles.length > 0) {
    console.log(`${verb} ${installedFiles.length} file(s).`);
  }
  if (plan.dependencies.length > 0 || plan.devDependencies.length > 0) {
    console.log(`Dependencies: ${[...plan.dependencies, ...plan.devDependencies].join(", ")}`);
  }
};
