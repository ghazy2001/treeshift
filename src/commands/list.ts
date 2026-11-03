import pc from "picocolors";
import path from "node:path";
import { isGitRepo, listWorktrees } from "../core/git.js";
import { formatBranch, formatStatus, formatAheadBehind } from "../ui/format.js";

export async function listCommand(options: { json?: boolean } = {}): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    console.error(pc.red("Error: Not inside a Git repository."));
    process.exit(1);
  }

  const worktrees = await listWorktrees();

  if (options.json) {
    console.log(JSON.stringify(worktrees, null, 2));
    return;
  }

  const currentDir = path.normalize(process.cwd()).toLowerCase();

  console.log(pc.bold("\nActive Git Worktrees:\n"));

  for (const wt of worktrees) {
    const isCurrent = path.normalize(wt.path).toLowerCase() === currentDir;
    const currentIndicator = isCurrent ? pc.magenta(" ➜ ") : "   ";
    const lockIcon = wt.isLocked ? pc.red("🔒 ") : "";
    const branchText = `${lockIcon}${formatBranch(wt.branch, wt.isMain)}`;
    const aheadBehindText = formatAheadBehind(wt);
    const dirtyText = formatStatus(wt);
    const relPath = path.relative(process.cwd(), wt.path) || ".";
    const timeText = wt.lastCommit?.relativeTime ? pc.dim(`(${wt.lastCommit.relativeTime})`) : "";

    console.log(
      `${currentIndicator}${branchText.padEnd(30)}${aheadBehindText} ${dirtyText}  ${pc.dim(relPath)} ${timeText}`
    );
  }

  console.log("");
}
