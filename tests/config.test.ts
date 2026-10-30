import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  sanitizeBranchName,
  resolveWorktreePath,
  DEFAULT_CONFIG,
} from "../src/core/config.js";

describe("config & path resolution", () => {
  it("sanitizes branch names correctly", () => {
    expect(sanitizeBranchName("feat/user-auth")).toBe("feat-user-auth");
    expect(sanitizeBranchName("fix/bug#123:critical")).toBe("fix-bug#123_critical");
    expect(sanitizeBranchName("release/v1.0.0")).toBe("release-v1.0.0");
  });

  it("resolves internal worktree paths under .worktrees by default", () => {
    const root = path.resolve("/projects/my-repo");
    const result = resolveWorktreePath(root, "feat/login", DEFAULT_CONFIG);
    expect(result).toBe(path.join(root, ".worktrees", "feat-user-auth".replace("user-auth", "login")));
  });

  it("resolves sibling worktree paths when location is sibling", () => {
    const root = path.resolve("/projects/my-repo");
    const result = resolveWorktreePath(root, "feat/login", {
      ...DEFAULT_CONFIG,
      location: "sibling",
    });
    expect(result).toBe(path.resolve("/projects", "my-repo-feat-login"));
  });
});
