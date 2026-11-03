import pc from "picocolors";
import { getShellIntegration } from "../core/shell.js";

export function initCommand(shellArg?: string): void {
  let shell = (shellArg?.toLowerCase() || "").trim();

  if (!shell) {
    const envShell = process.env.SHELL || "";
    if (envShell.includes("zsh")) shell = "zsh";
    else if (envShell.includes("bash")) shell = "bash";
    else if (envShell.includes("fish")) shell = "fish";
    else if (envShell.includes("nu")) shell = "nu";
    else if (process.platform === "win32") shell = "powershell";
    else shell = "bash";
  }

  if (
    shell !== "bash" &&
    shell !== "zsh" &&
    shell !== "fish" &&
    shell !== "powershell" &&
    shell !== "nu" &&
    shell !== "nushell"
  ) {
    console.error(
      pc.red(
        `Unsupported shell "${shell}". Supported: bash, zsh, fish, powershell, nu`
      )
    );
    process.exit(1);
  }

  const script = getShellIntegration(
    shell as "bash" | "zsh" | "fish" | "powershell" | "nu" | "nushell"
  );
  console.log(script);
}
