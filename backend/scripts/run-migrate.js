const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const distScript = path.join(projectRoot, "dist", "scripts", "migrate.js");

if (fs.existsSync(distScript)) {
        require(distScript);
        return;
}

const binBase = path.join(projectRoot, "node_modules", ".bin", "ts-node-dev");
const tsNodeDevBin = process.platform === "win32" ? `${binBase}.cmd` : binBase;

if (!fs.existsSync(tsNodeDevBin)) {
        // eslint-disable-next-line no-console
        console.error(
                "ts-node-dev binary not found. Build the project first or install dev dependencies."
        );
        process.exit(1);
}

const result = spawnSync(
        tsNodeDevBin,
        ["--transpile-only", "--exit-child", "src/scripts/migrate.ts"],
        {
                cwd: projectRoot,
                env: process.env,
                stdio: "inherit",
        }
);

if (typeof result.status === "number") {
        process.exit(result.status);
}

process.exit(1);
