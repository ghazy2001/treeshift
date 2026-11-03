import { spawn } from "node:child_process";

export type KnownEditor = "code" | "cursor" | "zed" | "subl" | "nvim" | "vim";

export interface EditorLaunchResult {
  launched: boolean;
  editor: string;
  error?: string;
}

export function openInEditor(
  editor: string,
  targetDir: string
): EditorLaunchResult {
  const cleanEditor = editor.trim();
  if (!cleanEditor) {
    return { launched: false, editor: "" };
  }

  try {
    const child = spawn(cleanEditor, [targetDir], {
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    child.unref();
    return { launched: true, editor: cleanEditor };
  } catch (err: any) {
    return { launched: false, editor: cleanEditor, error: err.message };
  }
}
