import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import {
  createCarryStash,
  applyCarryStash,
  dropStash,
  lockWorktree,
  unlockWorktree,
  listWorktrees,
  addWorktree,
} from "../src/core/git.js";

describe("carry stash and lock functionality", () => {
  let testRepoDir: string;

  beforeEach(() => {
    testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-git-"));
    execSync("git init -b main", { cwd: testRepoDir });
    execSync('git config user.name "Test User"', { cwd: testRepoDir });
    execSync('git config user.email "test@example.com"', { cwd: testRepoDir });

    // Initial commit
    fs.writeFileSync(path.join(testRepoDir, "README.md"), "# Test Repo\n", "utf8");
    execSync("git add README.md", { cwd: testRepoDir });
    execSync('git commit -m "initial commit"', { cwd: testRepoDir });
  });

  afterEach(() => {
    if (fs.existsSync(testRepoDir)) {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    }
  });

  it("creates, applies, and drops a carry stash across worktrees", async () => {
    // Modify a file and create an untracked file
    fs.appendFileSync(path.join(testRepoDir, "README.md"), "New WIP line\n", "utf8");
    fs.writeFileSync(path.join(testRepoDir, "new-file.txt"), "hello carry", "utf8");

    const stashSha = await createCarryStash(testRepoDir);
    expect(stashSha).toBeTruthy();

    // Verify current working tree was cleaned
    const status = execSync("git status --porcelain", { cwd: testRepoDir }).toString();
    expect(status.trim()).toBe("");

    // Create a new worktree
    const wtPath = path.join(testRepoDir, ".worktrees", "feat-carry-test");
    await addWorktree({
      branch: "feat-carry-test",
      targetPath: wtPath,
      createBranch: true,
      cwd: testRepoDir,
    });

    // Apply the carry stash
    const res = await applyCarryStash(stashSha!, wtPath);
    expect(res.success).toBe(true);
    expect(res.conflict).toBe(false);

    // Verify changes are present in the worktree
    expect(fs.readFileSync(path.join(wtPath, "new-file.txt"), "utf8")).toBe("hello carry");
    expect(fs.readFileSync(path.join(wtPath, "README.md"), "utf8")).toContain("New WIP line");

    // Drop stash
    await dropStash(stashSha!, testRepoDir);
  });

  it("locks and unlocks a worktree successfully", async () => {
    const wtPath = path.join(testRepoDir, ".worktrees", "feat-lock-test");
    await addWorktree({
      branch: "feat-lock-test",
      targetPath: wtPath,
      createBranch: true,
      cwd: testRepoDir,
    });

    await lockWorktree(wtPath, "testing lock mechanism", testRepoDir);

    let wts = await listWorktrees(testRepoDir);
    let lockedWt = wts.find((wt) => wt.path.toLowerCase() === wtPath.toLowerCase());
    expect(lockedWt?.isLocked).toBe(true);
    expect(lockedWt?.lockReason).toBe("testing lock mechanism");

    await unlockWorktree(wtPath, testRepoDir);

    wts = await listWorktrees(testRepoDir);
    lockedWt = wts.find((wt) => wt.path.toLowerCase() === wtPath.toLowerCase());
    expect(lockedWt?.isLocked).toBe(false);
  });
});
