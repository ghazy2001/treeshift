import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { getWorktreeStatusSummary } from "../src/core/git.js";
import { openInEditor } from "../src/core/editor.js";
import { formatStatus, formatAheadBehind } from "../src/ui/format.js";

describe("observability & diff counters", () => {
  let testRepoDir: string;

  beforeEach(() => {
    testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "treeshift-test-obs-"));
    execSync("git init -b main", { cwd: testRepoDir });
    execSync('git config user.name "Test User"', { cwd: testRepoDir });
    execSync('git config user.email "test@example.com"', { cwd: testRepoDir });

    fs.writeFileSync(path.join(testRepoDir, "tracked.txt"), "hello\n", "utf8");
    execSync("git add tracked.txt", { cwd: testRepoDir });
    execSync('git commit -m "initial commit"', { cwd: testRepoDir });
  });

  afterEach(() => {
    if (fs.existsSync(testRepoDir)) {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    }
  });

  it("accurately counts modified and untracked files", async () => {
    // Modify tracked file
    fs.appendFileSync(path.join(testRepoDir, "tracked.txt"), "updated\n", "utf8");

    // Add 2 untracked files
    fs.writeFileSync(path.join(testRepoDir, "untracked1.txt"), "a", "utf8");
    fs.writeFileSync(path.join(testRepoDir, "untracked2.txt"), "b", "utf8");

    const summary = await getWorktreeStatusSummary(testRepoDir);
    expect(summary.isDirty).toBe(true);
    expect(summary.modified).toBe(1);
    expect(summary.untracked).toBe(2);
  });

  it("formats status with modified and untracked badges", () => {
    const formatted = formatStatus({
      path: "/test",
      head: "123",
      branch: "main",
      isBare: false,
      isLocked: false,
      isMain: true,
      isDirty: true,
      statusSummary: { modified: 2, untracked: 3 },
    });
    expect(formatted).toContain("+2");
    expect(formatted).toContain("?3");
  });

  it("formats ahead/behind counters", () => {
    const formatted = formatAheadBehind({
      path: "/test",
      head: "123",
      branch: "feat",
      isBare: false,
      isLocked: false,
      isMain: false,
      aheadBehind: { ahead: 3, behind: 1 },
    });
    expect(formatted).toContain("↑3");
    expect(formatted).toContain("↓1");
  });
});

describe("editor launcher", () => {
  it("gracefully handles empty editor string", () => {
    const res = openInEditor("", "/test/dir");
    expect(res.launched).toBe(false);
  });
});
