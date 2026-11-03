import * as p from "@clack/prompts";
import pc from "picocolors";
import path from "node:path";
import fs from "node:fs";
import {
  isGitRepo,
  getMainRepoRoot,
  listWorktrees,
  addWorktree,
  ensureGitignoreEntry,
  fetchPullRequest,
} from "../core/git.js";
import { loadConfig, resolveWorktreePath } from "../core/config.js";
import { syncEnvFiles } from "../core/env-sync.js";
import { recordTargetDirectory } from "../core/shell.js";
import { openInEditor } from "../core/editor.js";

export interface PrOptions {
  path?: string;
  noEnv?: boolean;
  switch?: boolean;
  editor?: string;
}

export async function prCommand(
  prInput?: string,
  options: PrOptions = {}
): Promise<void> {
  const inRepo = await isGitRepo();
  if (!inRepo) {
    p.cancel(pc.red("Not inside a Git repository."));
    process.exit(1);
  }

  const mainRoot = await getMainRepoRoot();
  const config = loadConfig(mainRoot);

  let input = prInput?.trim();
  if (!input) {
    const response = await p.text({
      message: "Enter GitHub Pull Request number or URL:",
      placeholder: "123 or https://github.com/org/repo/pull/123",
      validate: (val) => {
        if (!val || !val.trim()) return "Pull Request number or URL cannot be empty.";
      },
    });

    if (p.isCancel(response)) {
      p.cancel("Operation cancelled.");
      return;
    }
    input = (response as string).trim();
  }

  if (!input) {
    p.cancel("Operation cancelled.");
    return;
  }

  // Parse PR number
  const match = input.match(/(?:pull\/|^#?)(\d+)/i);
  if (!match || !match[1]) {
    p.cancel(pc.red(`Could not parse valid PR number from "${input}".`));
    process.exit(1);
  }

  const prNumber = parseInt(match[1], 10);
  const branch = `pr/${prNumber}`;

  // Check if worktree for this PR already exists
  const existingWorktrees = await listWorktrees();
  const alreadyAttached = existingWorktrees.find((wt) => wt.branch === branch);
  if (alreadyAttached) {
    p.log.warn(
      `Worktree for PR #${pc.yellow(prNumber.toString())} already exists at:\n  ${pc.dim(alreadyAttached.path)}`
    );
    const shouldSwitch = await p.confirm({
      message: "Switch to existing PR worktree?",
      initialValue: true,
    });
    if (!p.isCancel(shouldSwitch) && shouldSwitch) {
      recordTargetDirectory(alreadyAttached.path);
      p.outro(pc.green(`Switched to: ${alreadyAttached.path}`));
    }
    return;
  }

  // Fetch PR from origin
  const sFetch = p.spinner();
  sFetch.start(`Fetching PR #${pc.yellow(prNumber.toString())} from origin...`);

  let prDetails;
  try {
    prDetails = await fetchPullRequest(prNumber, mainRoot);
    const titleInfo = prDetails.title ? ` — "${pc.dim(prDetails.title)}"` : "";
    sFetch.stop(`Fetched PR #${pc.yellow(prNumber.toString())}${titleInfo}`);
  } catch (err: any) {
    sFetch.stop(pc.red("Failed to fetch PR."));
    p.cancel(err.message);
    process.exit(1);
  }

  // Resolve target directory
  const targetPath = options.path
    ? path.resolve(options.path)
    : resolveWorktreePath(mainRoot, branch, config);

  if (fs.existsSync(targetPath)) {
    p.cancel(pc.red(`Target path already exists: ${targetPath}`));
    process.exit(1);
  }

  const sCreate = p.spinner();
  sCreate.start(`Creating PR worktree at ${pc.dim(path.relative(mainRoot, targetPath) || targetPath)}...`);

  try {
    await addWorktree({
      branch,
      targetPath,
      createBranch: false,
      cwd: mainRoot,
    });
    sCreate.stop(`Mounted PR #${pc.yellow(prNumber.toString())} into worktree`);

    if (config.location === "internal") {
      ensureGitignoreEntry(mainRoot, config.internalDir);
    }
  } catch (err: any) {
    sCreate.stop(pc.red("Failed to create PR worktree."));
    p.cancel(err.message);
    process.exit(1);
  }

  // Env sync
  const shouldSyncEnv = !options.noEnv && config.syncEnv;
  if (shouldSyncEnv) {
    const syncRes = await syncEnvFiles(mainRoot, targetPath, {
      customFiles: config.envFiles,
    });
    if (syncRes.synced.length > 0) {
      p.log.success(`Synced env files: ${pc.dim(syncRes.synced.join(", "))}`);
    }
  }

  // Auto switch
  if (options.switch !== false) {
    recordTargetDirectory(targetPath);
  }

  // Open in editor if requested
  if (options.editor) {
    openInEditor(options.editor, targetPath);
  }

  p.outro(
    `${pc.green("PR Worktree ready!")} 🚀\n  ${pc.bold("PR:")}       #${prNumber}${prDetails.title ? ` (${prDetails.title})` : ""}\n  ${pc.bold("Location:")} ${pc.cyan(targetPath)}\n  ${pc.bold("Branch:")}   ${pc.blue(branch)}`
  );
}
