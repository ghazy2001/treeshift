#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { switchCommand } from "./commands/switch.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { cleanCommand } from "./commands/clean.js";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
  .name("treeshift")
  .description("⚡ Blazing-fast Git worktree manager with auto-sync and interactive TUI")
  .version("0.1.0");

// Default action (interactive dashboard) when no subcommand is given
program
  .action(async () => {
    try {
      await switchCommand();
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("switch [branch]")
  .alias("sw")
  .description("Switch to a worktree or open interactive switcher")
  .action(async (branch?: string) => {
    try {
      await switchCommand(branch);
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("add [branch] [base]")
  .alias("new")
  .alias("create")
  .description("Create a new worktree with automatic .env sync")
  .option("-p, --path <path>", "Custom target directory for the worktree")
  .option("--no-env", "Do not sync .env files to the new worktree")
  .option("--no-switch", "Do not switch directory to the new worktree")
  .action(async (branch?: string, base?: string, opts?: any) => {
    try {
      await addCommand(branch, {
        base,
        path: opts?.path,
        noEnv: opts?.env === false,
        switch: opts?.switch !== false,
      });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("list")
  .alias("ls")
  .description("List all active worktrees and their status")
  .option("--json", "Output worktree list in JSON format")
  .action(async (opts: { json?: boolean }) => {
    try {
      await listCommand(opts);
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("remove [target]")
  .alias("rm")
  .alias("delete")
  .description("Remove a worktree and optionally delete its branch")
  .option("-f, --force", "Force removal even if there are uncommitted changes")
  .option("-D, --delete-branch", "Delete the corresponding local branch")
  .action(async (target?: string, opts?: any) => {
    try {
      await removeCommand(target, {
        force: opts?.force,
        deleteBranch: opts?.deleteBranch,
      });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("clean")
  .alias("prune")
  .description("Scan and prune worktrees merged into the default branch")
  .option("-f, --force", "Force removal without prompt")
  .action(async (opts?: any) => {
    try {
      await cleanCommand({ force: opts?.force });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("init [shell]")
  .description("Output shell integration script (bash, zsh, fish, powershell)")
  .action((shell?: string) => {
    initCommand(shell);
  });

program.parse(process.argv);
