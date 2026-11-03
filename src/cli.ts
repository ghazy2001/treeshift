#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { switchCommand } from "./commands/switch.js";
import { addCommand } from "./commands/add.js";
import { listCommand } from "./commands/list.js";
import { removeCommand } from "./commands/remove.js";
import { cleanCommand } from "./commands/clean.js";
import { initCommand } from "./commands/init.js";
import { prCommand } from "./commands/pr.js";
import { lockCommand, unlockCommand } from "./commands/lock.js";

const program = new Command();

program
  .name("treeshift")
  .description("⚡ Blazing-fast Git worktree manager with auto-sync and interactive TUI")
  .version("0.2.0");

function resolveEditor(opts?: any): string | undefined {
  if (opts?.code) return "code";
  if (opts?.cursor) return "cursor";
  if (opts?.zed) return "zed";
  if (opts?.editor) return opts.editor;
  return undefined;
}

// Default action (interactive dashboard) when no subcommand is given
program
  .option("-e, --editor <name>", "Open worktree in editor upon switching")
  .option("--code", "Open worktree in VS Code")
  .option("--cursor", "Open worktree in Cursor")
  .option("--zed", "Open worktree in Zed")
  .action(async (opts?: any) => {
    try {
      await switchCommand(undefined, { editor: resolveEditor(opts) });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("switch [branch]")
  .alias("sw")
  .description("Switch to a worktree or open interactive switcher")
  .option("-e, --editor <name>", "Open worktree in editor")
  .option("--code", "Open worktree in VS Code")
  .option("--cursor", "Open worktree in Cursor")
  .option("--zed", "Open worktree in Zed")
  .action(async (branch?: string, opts?: any) => {
    try {
      await switchCommand(branch, { editor: resolveEditor(opts) });
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
  .option("-c, --carry", "Carry over uncommitted / staged changes to the new worktree")
  .option("-i, --install", "Automatically install dependencies in the new worktree")
  .option("-e, --editor <name>", "Open worktree in editor upon creation")
  .option("--code", "Open worktree in VS Code")
  .option("--cursor", "Open worktree in Cursor")
  .option("--zed", "Open worktree in Zed")
  .option("--no-env", "Do not sync .env files to the new worktree")
  .option("--no-switch", "Do not switch directory to the new worktree")
  .action(async (branch?: string, base?: string, opts?: any) => {
    try {
      await addCommand(branch, {
        base,
        path: opts?.path,
        noEnv: opts?.env === false,
        switch: opts?.switch !== false,
        carry: opts?.carry,
        install: opts?.install,
        editor: resolveEditor(opts),
      });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("pr [pull-request]")
  .description("Mount a GitHub Pull Request into an isolated worktree for review")
  .option("-p, --path <path>", "Custom target directory for the worktree")
  .option("-e, --editor <name>", "Open worktree in editor upon creation")
  .option("--code", "Open worktree in VS Code")
  .option("--cursor", "Open worktree in Cursor")
  .option("--zed", "Open worktree in Zed")
  .option("--no-env", "Do not sync .env files to the new worktree")
  .option("--no-switch", "Do not switch directory to the new worktree")
  .action(async (pullRequest?: string, opts?: any) => {
    try {
      await prCommand(pullRequest, {
        path: opts?.path,
        noEnv: opts?.env === false,
        switch: opts?.switch !== false,
        editor: resolveEditor(opts),
      });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("lock [target]")
  .description("Lock a worktree to prevent accidental deletion or cleanup")
  .option("-r, --reason <reason>", "Reason for locking the worktree")
  .action(async (target?: string, opts?: any) => {
    try {
      await lockCommand(target, { reason: opts?.reason });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("unlock [target]")
  .description("Unlock a previously locked worktree")
  .action(async (target?: string) => {
    try {
      await unlockCommand(target);
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
  .option("--dry-run", "Preview removal without modifying disk or Git refs")
  .action(async (target?: string, opts?: any) => {
    try {
      await removeCommand(target, {
        force: opts?.force,
        deleteBranch: opts?.deleteBranch,
        dryRun: opts?.dryRun,
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
  .option("--dry-run", "Preview merged worktrees without modifying disk or Git refs")
  .action(async (opts?: any) => {
    try {
      await cleanCommand({ force: opts?.force, dryRun: opts?.dryRun });
    } catch (err: any) {
      console.error(pc.red(`\nError: ${err.message}`));
      process.exit(1);
    }
  });

program
  .command("init [shell]")
  .description("Output shell integration script (bash, zsh, fish, powershell, nu)")
  .action((shell?: string) => {
    initCommand(shell);
  });

program.parse(process.argv);
