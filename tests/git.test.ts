import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import {
  isWorktreeDirty,
  isBranchSquashMerged,
  getMergedBranches,
  getUnpushedCommits,
} from "../src/core/git.js";

describe("git core safety and squash merge detection", () => {
  let tmpRepoDir: string;

  beforeEach(() => {
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-repo-"));
    execSync("git init -b main", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git config user.name "Test User"', { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git config user.email "test@example.com"', { cwd: tmpRepoDir, stdio: "ignore" });

    // Initial commit on main
    fs.writeFileSync(path.join(tmpRepoDir, "README.md"), "# Initial Commit\n");
    execSync("git add README.md", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git commit -m "Initial commit"', { cwd: tmpRepoDir, stdio: "ignore" });
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpRepoDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("isWorktreeDirty returns true as a fail-safe on non-existent or invalid git directory", async () => {
    const invalidPath = path.join(tmpRepoDir, "non-existent-subpath-xyz");
    const isDirty = await isWorktreeDirty(invalidPath);
    expect(isDirty).toBe(true);
  });

  it("detects regular merged branches correctly", async () => {
    // Create feature branch
    execSync("git checkout -b feat/regular", { cwd: tmpRepoDir, stdio: "ignore" });
    fs.writeFileSync(path.join(tmpRepoDir, "regular.txt"), "regular feature\n");
    execSync("git add regular.txt", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git commit -m "feat: regular"', { cwd: tmpRepoDir, stdio: "ignore" });

    // Merge normally into main
    execSync("git checkout main", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git merge --no-ff feat/regular -m "Merge branch feat/regular"', {
      cwd: tmpRepoDir,
      stdio: "ignore",
    });

    const result = await getMergedBranches("main", ["feat/regular"], tmpRepoDir);
    expect(result.merged).toContain("feat/regular");
    expect(result.all).toContain("feat/regular");
  });

  it("detects squash-merged branches that git branch --merged misses", async () => {
    // Create feature branch
    execSync("git checkout -b feat/squashed", { cwd: tmpRepoDir, stdio: "ignore" });
    fs.writeFileSync(path.join(tmpRepoDir, "feature.txt"), "feature content\n");
    execSync("git add feature.txt", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git commit -m "feat: step 1"', { cwd: tmpRepoDir, stdio: "ignore" });
    fs.appendFileSync(path.join(tmpRepoDir, "feature.txt"), "more content\n");
    execSync("git add feature.txt", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git commit -m "feat: step 2"', { cwd: tmpRepoDir, stdio: "ignore" });

    // Perform a squash merge into main (mimicking GitHub squash & merge)
    execSync("git checkout main", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync("git merge --squash feat/squashed", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git commit -m "feat: squashed feature (#42)"', {
      cwd: tmpRepoDir,
      stdio: "ignore",
    });

    // Standard git branch --merged fails to identify squash merges
    const standardMergedOutput = execSync("git branch --merged main", {
      cwd: tmpRepoDir,
      encoding: "utf8",
    });
    expect(standardMergedOutput.includes("feat/squashed")).toBe(false);

    // Our isBranchSquashMerged detects it correctly
    const isSquashed = await isBranchSquashMerged("feat/squashed", "main", tmpRepoDir);
    expect(isSquashed).toBe(true);

    // And getMergedBranches returns it under squashed and all
    const result = await getMergedBranches("main", ["feat/squashed"], tmpRepoDir);
    expect(result.squashed).toContain("feat/squashed");
    expect(result.all).toContain("feat/squashed");
  });

  it("getUnpushedCommits identifies commits not yet integrated or pushed", async () => {
    execSync("git checkout -b feat/unpushed", { cwd: tmpRepoDir, stdio: "ignore" });
    fs.writeFileSync(path.join(tmpRepoDir, "unpushed.txt"), "work in progress\n");
    execSync("git add unpushed.txt", { cwd: tmpRepoDir, stdio: "ignore" });
    execSync('git commit -m "wip: local commit"', { cwd: tmpRepoDir, stdio: "ignore" });

    const unpushed = await getUnpushedCommits("feat/unpushed", "main", tmpRepoDir);
    expect(unpushed.length).toBe(1);
    expect(unpushed[0]).toContain("wip: local commit");
  });
});
