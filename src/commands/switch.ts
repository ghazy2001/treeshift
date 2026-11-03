import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import { isGitRepo, listWorktrees } from "../core/git.js";
import { formatWorktreeOption } from "../ui/format.js";
import { recordTargetDirectory } from "../core/shell.js";
import { addCommand } from "./add.js";
import { cleanCommand } from "./clean.js";
import { removeCommand } from "./remove.js";
import { prCommand } from "./pr.js";
import { openInEditor } from "../core/editor.js";

const ACTION_NEW = "__ACTION_NEW__";
const ACTION_PR = "__ACTION_PR__";
const ACTION_CLEAN = "__ACTION_CLEAN__";
const ACTION_REMOVE = "__ACTION_REMOVE__";

export async function switchCommand(
  targetBranch?: string,
  switchOptions: { editor?: string } = {}
): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    p.cancel(pc.red("Not inside a Git repository."));
    process.exit(1);
  }

  const worktrees = await listWorktrees();
  const currentDir = path.normalize(process.cwd()).toLowerCase();

  // If a branch/path target was explicitly passed
  if (targetBranch) {
    const norm = path.normalize(targetBranch).toLowerCase();
    const match = worktrees.find(
      (wt) =>
        wt.branch === targetBranch ||
        path.normalize(wt.path).toLowerCase() === norm ||
        path.basename(wt.path).toLowerCase() === norm
    );

    if (match) {
      if (path.normalize(match.path).toLowerCase() === currentDir) {
        if (switchOptions.editor) {
          openInEditor(switchOptions.editor, match.path);
          p.outro(`Opened in ${pc.cyan(switchOptions.editor)} 🚀`);
          return;
        }
        p.log.info(pc.dim("Already inside this worktree."));
        return;
      }
      recordTargetDirectory(match.path);
      if (switchOptions.editor) {
        openInEditor(switchOptions.editor, match.path);
      }
      p.outro(pc.green(`Switched to: ${match.path}`));
      return;
    }

    // Branch not attached to worktree yet: ask to create
    p.log.warn(`No worktree found for branch: ${pc.blue(targetBranch)}`);
    const shouldCreate = await p.confirm({
      message: `Create a new worktree for ${pc.blue(targetBranch)}?`,
      initialValue: true,
    });

    if (!p.isCancel(shouldCreate) && shouldCreate) {
      await addCommand(targetBranch);
    }
    return;
  }

  // Interactive menu
  p.intro(pc.bgCyan(pc.black(" treeshift ")) + pc.dim(" — Git Worktrees Dashboard"));

  const options: Array<{ value: string; label: string; hint?: string }> = worktrees.map((wt) =>
    formatWorktreeOption(wt, currentDir)
  );

  // Add action entries at the bottom
  options.push(
    {
      value: ACTION_NEW,
      label: pc.green("+ Create new worktree"),
      hint: "branch & workspace",
    },
    {
      value: ACTION_PR,
      label: pc.blue("🐙 Mount GitHub Pull Request"),
      hint: "review or test a PR",
    },
    {
      value: ACTION_CLEAN,
      label: pc.yellow("🧹 Clean merged worktrees"),
      hint: "bulk prune merged branches",
    },
    {
      value: ACTION_REMOVE,
      label: pc.red("🗑️  Remove a worktree"),
      hint: "delete worktree directory",
    }
  );

  const selected = await p.select({
    message: "Select a worktree to switch to, or choose an action:",
    options,
  });

  if (p.isCancel(selected)) {
    p.cancel("Cancelled.");
    return;
  }

  if (selected === ACTION_NEW) {
    await addCommand();
    return;
  }

  if (selected === ACTION_PR) {
    await prCommand();
    return;
  }

  if (selected === ACTION_CLEAN) {
    await cleanCommand();
    return;
  }

  if (selected === ACTION_REMOVE) {
    await removeCommand();
    return;
  }

  const targetPath = selected as string;
  if (path.normalize(targetPath).toLowerCase() === currentDir) {
    p.outro(pc.dim("Already inside this worktree."));
    return;
  }

  recordTargetDirectory(targetPath);
  if (switchOptions.editor) {
    openInEditor(switchOptions.editor, targetPath);
  }
  p.outro(`${pc.green("Switched to:")} ${pc.cyan(targetPath)}`);
}
