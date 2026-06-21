#!/usr/bin/env node
import { spawn } from "node:child_process";

const auditArgs = ["audit", "--audit-level=high", "--json"];

function runNpmAudit() {
  return new Promise((resolve) => {
    const child = spawn("npm", auditArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}${error.message}\n` });
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function isAuditServiceFailure(result, payload) {
  const combined = `${result.stderr}\n${result.stdout}`.toLowerCase();
  const statusCode = Number(payload?.statusCode ?? payload?.error?.code);
  const message = String(payload?.message ?? payload?.error?.summary ?? payload?.error?.detail ?? "").toLowerCase();

  return (
    statusCode >= 400 ||
    combined.includes("audit endpoint returned an error") ||
    combined.includes("econnreset") ||
    combined.includes("etimedout") ||
    combined.includes("enotfound") ||
    combined.includes("eai_again") ||
    combined.includes("socket timeout") ||
    message.includes("forbidden")
  );
}

function highOrCriticalCount(payload) {
  const vulnerabilities = payload?.metadata?.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") return null;

  return Number(vulnerabilities.high ?? 0) + Number(vulnerabilities.critical ?? 0);
}

const result = await runNpmAudit();
const payload = extractJson(result.stdout) ?? extractJson(result.stderr);
const severeCount = payload ? highOrCriticalCount(payload) : null;

if (result.stdout.trim()) process.stdout.write(result.stdout);
if (result.stderr.trim()) process.stderr.write(result.stderr);

if (result.code === 0) {
  console.log("npm audit high: no high or critical vulnerabilities reported.");
  process.exit(0);
}

if (severeCount !== null) {
  if (severeCount > 0) {
    console.error(`npm audit high: found ${severeCount} high/critical vulnerabilit${severeCount === 1 ? "y" : "ies"}.`);
    process.exit(1);
  }

  console.log("npm audit high: npm exited non-zero, but JSON metadata reports no high or critical vulnerabilities.");
  process.exit(0);
}

if (isAuditServiceFailure(result, payload)) {
  console.warn("npm audit high: audit service was unreachable or rejected the request; treating as an environment warning so unrelated CI signal remains visible.");
  process.exit(0);
}

console.error("npm audit high: failed before vulnerability metadata could be read.");
process.exit(result.code || 1);
