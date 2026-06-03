import path from "node:path";
import { addItems, initProject } from "./installer.js";
import { getPublicItems, loadRegistry } from "./registry.js";

export const runCli = async (argv) => {
  const { command, args, options } = parseArgs(argv);

  switch (command) {
    case "init":
      await initProject(options);
      return;
    case "add":
      await addItems(args, options);
      return;
    case "list":
      await listItems();
      return;
    case "help":
    case undefined:
      printHelp();
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
};

export const parseArgs = (argv) => {
  const args = [];
  const options = {
    cwd: process.cwd(),
    yes: false,
    overwrite: false,
    skipExisting: false,
    dryRun: false,
    example: false,
  };

  let command;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (!command && !arg.startsWith("-")) {
      command = arg;
      continue;
    }

    if (arg === "--cwd" || arg === "-c") {
      const next = argv[++index];
      if (next === undefined || next.startsWith("-")) {
        throw new Error(`Missing value for ${arg}`);
      }
      options.cwd = path.resolve(next);
      continue;
    }
    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }
    if (arg === "--overwrite") {
      options.overwrite = true;
      continue;
    }
    if (arg === "--skip-existing") {
      options.skipExisting = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--example") {
      options.example = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      command = "help";
      continue;
    }

    args.push(arg);
  }

  return { command, args, options };
};

const listItems = async () => {
  const registry = await loadRegistry();
  for (const item of getPublicItems(registry)) {
    console.log(`${item.name.padEnd(20)} ${item.title ?? item.description ?? ""}`);
  }
};

const printHelp = () => {
  console.log(`intentface

Usage:
  intentface init [options]
  intentface add <items...> [options]
  intentface list

Options:
  -c, --cwd <path>       Working directory
  -y, --yes              Skip confirmation prompts
  --overwrite            Overwrite existing files
  --skip-existing        Skip existing files
  --dry-run              Print planned changes without writing
  --example              Include optional example files
`);
};
