import { ReplitConnectors } from "@replit/connectors-sdk";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const OWNER = "zaydn4321";
const REPO = "Msa-Hackathon";
const BRANCH = "main";

const connectors = new ReplitConnectors();

async function ghApi(path, options = {}, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await connectors.proxy("github", path, options);
    if (response.status === 429) {
      const wait = (attempt + 1) * 2000;
      console.log(`Rate limited, waiting ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!response.ok && response.status !== 422) {
      const text = await response.text();
      throw new Error(`GitHub API error ${response.status} at ${path}: ${text}`);
    }
    return response;
  }
  throw new Error(`Exhausted retries for ${path}`);
}

async function ghJson(path, options = {}) {
  const res = await ghApi(path, options);
  return res.json();
}

async function main() {
  console.log(`Pushing to ${OWNER}/${REPO}...`);

  const repoRoot = execSync("git rev-parse --show-toplevel").toString().trim();

  let trackedFiles = execSync("git ls-files", { cwd: repoRoot })
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);

  console.log(`Found ${trackedFiles.length} tracked files`);

  let baseCommitSha;
  let baseTreeSha;

  try {
    const ref = await ghJson(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    baseCommitSha = ref.object.sha;
    const commit = await ghJson(`/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`);
    baseTreeSha = commit.tree.sha;
    console.log(`Base commit: ${baseCommitSha}`);
  } catch (e) {
    console.log("Branch not found, will create it");
    baseCommitSha = null;
    baseTreeSha = null;
  }

  console.log("Creating blobs...");

  const treeItems = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const BATCH = 5;
  for (let i = 0; i < trackedFiles.length; i += BATCH) {
    const batch = trackedFiles.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (filePath) => {
        const absPath = join(repoRoot, filePath);
        if (!existsSync(absPath)) return;

        let encoding = "utf-8";
        let content;
        try {
          content = readFileSync(absPath, "utf-8");
        } catch {
          content = readFileSync(absPath).toString("base64");
          encoding = "base64";
        }

        const blob = await ghJson(`/repos/${OWNER}/${REPO}/git/blobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, encoding }),
        });

        treeItems.push({
          path: filePath,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      })
    );
    console.log(`  Blobs: ${Math.min(i + BATCH, trackedFiles.length)}/${trackedFiles.length}`);
    if (i + BATCH < trackedFiles.length) await sleep(600);
  }

  console.log("Creating tree...");
  const treePayload = { tree: treeItems };
  if (baseTreeSha) treePayload.base_tree = baseTreeSha;
  const tree = await ghJson(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(treePayload),
  });

  console.log("Creating commit...");
  const commitPayload = {
    message: "feat: Anamnesis — patient intake & provider dashboard web app\n\nFull-stack monorepo with React + Vite frontend, Express API, and PostgreSQL. Includes patient intake session flow, provider clinical brief dashboard with biometric HR/HRV charts, and OpenAPI-generated React Query hooks.",
    tree: tree.sha,
  };
  if (baseCommitSha) commitPayload.parents = [baseCommitSha];

  const commit = await ghJson(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(commitPayload),
  });

  console.log("Updating branch ref...");
  const refPath = `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`;
  if (baseCommitSha) {
    await ghApi(refPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: true }),
    });
  } else {
    await ghApi(`/repos/${OWNER}/${REPO}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.sha }),
    });
  }

  console.log(`\nDone! Pushed to https://github.com/${OWNER}/${REPO}/tree/${BRANCH}`);
}

main().catch((err) => {
  console.error("Push failed:", err.message);
  process.exit(1);
});
