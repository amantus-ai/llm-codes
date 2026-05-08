#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const baseUrlArgIndex = args.indexOf("--base-url");
const configuredBaseUrl =
  process.env.VERIFY_BASE_URL || (baseUrlArgIndex >= 0 ? args[baseUrlArgIndex + 1] : undefined);
const port = configuredBaseUrl
  ? undefined
  : process.env.PORT
    ? Number(process.env.PORT)
    : await findOpenPort(3220);
const baseUrl = configuredBaseUrl?.replace(/\/$/, "") || `http://127.0.0.1:${port}`;

const codeTargets = [
  "https://docs.openclaw.ai/",
  "https://docs.cypress.io/app/get-started/why-cypress",
  "https://nextjs.org/docs/app/getting-started/installation",
];
const crawlTargets = ["https://docs.openclaw.ai/"];

if (!configuredBaseUrl && !process.env.FIRECRAWL_API_KEY) {
  console.error("FIRECRAWL_API_KEY is required for local live mode verification.");
  process.exit(2);
}

let server;
let serverOutput = "";

if (!configuredBaseUrl) {
  await run("pnpm", ["run", "build"]);

  server = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
  });

  server.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
}

try {
  await waitForServer(`${baseUrl}/api/cache/stats`);

  const codeOnlyResults = [];
  for (const target of codeTargets) {
    const scrape = await scrapeUrl(target);
    const codeBlocks = extractCodeBlocks(scrape.markdown);
    codeOnlyResults.push({
      target,
      chars: scrape.markdown.length,
      codeBlocks: codeBlocks.length,
      cached: scrape.cached,
    });
  }

  const pagesWithCode = codeOnlyResults.filter((result) => result.codeBlocks > 0);
  if (pagesWithCode.length < 2) {
    throw new Error(`Expected at least 2 code-heavy docs pages, got ${pagesWithCode.length}.`);
  }

  const crawlResults = [];
  for (const target of crawlTargets) {
    const crawl = await crawlUrl(target, { limit: 3, maxDepth: 1 });
    crawlResults.push(crawl);
  }

  console.log(
    JSON.stringify(
      {
        baseUrl,
        codeOnlyResults,
        crawlResults,
      },
      null,
      2,
    ),
  );
} finally {
  server?.kill("SIGTERM");
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + 50; port++) {
    if (await isPortOpen(port)) return port;
  }
  throw new Error(`No open port found from ${startPort} to ${startPort + 49}`);
}

async function isPortOpen(port) {
  return await new Promise((resolve) => {
    const tester = net.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) {
      throw new Error(`next start exited early:\n${serverOutput}`);
    }

    try {
      await fetch(url);
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error(`Timed out waiting for ${url}:\n${serverOutput}`);
}

async function scrapeUrl(url) {
  const response = await fetch(`${baseUrl}/api/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "scrape", url }),
  });

  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(`Scrape failed for ${url}: ${body.error || response.status}`);
  }

  const markdown = body.data?.markdown || "";
  if (markdown.length < 200) {
    throw new Error(`Scrape too small for ${url}: ${markdown.length} chars`);
  }

  return {
    markdown,
    cached: Boolean(body.cached),
  };
}

async function crawlUrl(url, { limit, maxDepth }) {
  const startResponse = await fetch(`${baseUrl}/api/crawl/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, limit, maxDepth }),
  });
  const startBody = await startResponse.json();

  if (!startResponse.ok || !startBody.success) {
    throw new Error(`Crawl start failed for ${url}: ${startBody.error || startResponse.status}`);
  }

  if (startBody.limit !== limit || startBody.maxDepth !== maxDepth) {
    throw new Error(
      `Crawl start echoed limit/depth ${startBody.limit}/${startBody.maxDepth}, expected ${limit}/${maxDepth}`,
    );
  }

  const events = await readCrawlEvents(startBody.jobId);
  const completed = events.find((event) => event.type === "complete");
  const pages = events.filter((event) => event.type === "url_complete");
  const errors = events.filter((event) => event.type === "error");

  if (errors.length) {
    throw new Error(
      `Crawl reported errors for ${url}: ${errors.map((event) => event.error).join("; ")}`,
    );
  }

  if (!completed) {
    throw new Error(`Crawl did not complete for ${url}`);
  }

  if (!pages.length) {
    throw new Error(`Crawl completed with no pages for ${url}`);
  }

  return {
    target: url,
    jobId: startBody.jobId,
    limit,
    maxDepth,
    completedPages: pages.length,
    creditsUsed: completed.creditsUsed || 0,
  };
}

async function readCrawlEvents(jobId) {
  const response = await fetch(`${baseUrl}/api/crawl/${jobId}/status`, {
    signal: AbortSignal.timeout(180000),
  });

  if (!response.ok) {
    throw new Error(`Crawl status failed for ${jobId}: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error(`Crawl status had no response body for ${jobId}`);

  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;

      const event = JSON.parse(payload);
      events.push(event);
      if (event.type === "complete") return events;
    }
  }

  return events;
}

function extractCodeBlocks(markdown) {
  const blocks = [];
  const pattern = /```[^\n]*\n[\s\S]*?```/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    if (match[0].trim().length > 6) blocks.push(match[0]);
  }
  return blocks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
