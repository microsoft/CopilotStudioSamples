import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync } from "fflate";

const [command, ...args] = process.argv.slice(2);
if (command === "run" && args[0] === "build") {
  execFileSync(process.execPath, [join(process.cwd(), "node_modules/typescript/bin/tsc")], { stdio: "inherit" });
} else {
  const source = args.includes("--src-path") ? args[args.indexOf("--src-path") + 1] : undefined;
  const reply = await fetch(new URL("/cli", process.env.RELAY_TEST_SERVICE), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, args, files: source ? Object.keys(unzipSync(readFileSync(source))) : undefined }),
  });
  const result = await reply.json();
  if (result.host) {
    process.stdout.write("Connect via browser: https://alias-3978.uks1.dev");
    setTimeout(() => process.stdout.write("tunnels.ms\n"), 20);
    setInterval(() => {}, 1000);
  } else {
    if (result.stdout !== undefined) process.stdout.write(result.stdout);
    process.exitCode = result.code ?? 0;
  }
}
