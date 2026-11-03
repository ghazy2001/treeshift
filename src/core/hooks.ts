import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export type LifecycleHook = "postAdd" | "preRemove" | "postSwitch";

export async function executeHook(
  hookName: LifecycleHook,
  command: string | undefined,
  targetDir: string
): Promise<{ executed: boolean; success: boolean; error?: string }> {
  if (!command || !command.trim()) {
    return { executed: false, success: true };
  }

  try {
    await execAsync(command, {
      cwd: targetDir,
      env: {
        ...process.env,
        TREESHIFT_HOOK: hookName,
        TREESHIFT_TARGET_DIR: targetDir,
      },
      timeout: 60_000,
    });
    return { executed: true, success: true };
  } catch (err: any) {
    return { executed: true, success: false, error: err.message };
  }
}
