#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const targetUrl = args[0] || "https://docs.clawd.bot/";
const port = process.env.PORT ? Number(process.env.PORT) : await findOpenPort(3210);
const baseUrl = `http://127.0.0.1:${port}`;

if (!process.env.FIRECRAWL_API_KEY) {
  console.error("FIRECRAWL_API_KEY is required for live Firecrawl verification.");
  process.exit(2);
}

await run("pnpm", ["run", "build"]);

const server = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(port) },
});

let serverOutput = "";
server.stdout.on("data", (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  serverOutput += chunk.toString();
});

try {
  await waitForServer(`${baseUrl}/api/cache/stats`);

  const root = await scrape(targetUrl);
  const links = extractLinks(root.markdown, targetUrl);
  const llmsUrl = links.find((url) => new URL(url).pathname === "/llms.txt");

  console.log(
    JSON.stringify(
      {
        targetUrl,
        rootChars: root.markdown.length,
        discoveredLinks: links.length,
        llmsTxt: llmsUrl || null,
        cached: root.cached,
      },
      null,
      2,
    ),
  );

  if (root.markdown.length < 200) {
    throw new Error(`Root scrape too small: ${root.markdown.length} chars`);
  }

  if (!links.length) {
    throw new Error("No follow-up links discovered from root scrape.");
  }

  if (llmsUrl) {
    const llms = await scrape(llmsUrl);
    console.log(
      JSON.stringify(
        {
          llmsUrl,
          llmsChars: llms.markdown.length,
          llmsLinks: extractLinks(llms.markdown, llmsUrl).length,
          cached: llms.cached,
        },
        null,
        2,
      ),
    );

    if (llms.markdown.length < 1000) {
      throw new Error(`llms.txt scrape too small: ${llms.markdown.length} chars`);
    }
  }
} finally {
  server.kill("SIGTERM");
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
    if (server.exitCode !== null) {
      throw new Error(`next start exited early:\n${serverOutput}`);
    }

    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Timed out waiting for ${url}:\n${serverOutput}`);
}

async function scrape(url) {
  const response = await fetch(`${baseUrl}/api/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "scrape", url }),
  });

  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(`Scrape failed for ${url}: ${body.error || response.status}`);
  }

  return {
    markdown: body.data?.markdown || "",
    cached: body.cached,
  };
}

function extractLinks(markdown, baseUrl) {
  const base = new URL(baseUrl);
  const potentialLinks = [];
  const patterns = [
    /\[([^\]]+)\]\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g,
    /href="([^"]+)"/g,
    /href='([^']+)'/g,
    /https?:\/\/[^\s<>"{}|\\^[\]`]+/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const href = match[2] || match[1] || match[0];
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
      try {
        potentialLinks.push(new URL(stripTrailingUrlPunctuation(href), base));
      } catch {}
    }
  }

  const allowedOrigins = inferAllowedOrigins(potentialLinks, base);
  return Array.from(
    new Set(
      potentialLinks
        .filter((url) => allowedOrigins.has(url.origin))
        .filter((url) => !isAssetPath(url.pathname.toLowerCase()))
        .map((url) => {
          url.hash = "";
          url.search = "";
          return url.href.endsWith("/") && url.pathname !== "/" ? url.href.slice(0, -1) : url.href;
        }),
    ),
  );
}

function inferAllowedOrigins(links, baseUrl) {
  const allowed = new Set([baseUrl.origin]);
  if (links.some((link) => link.origin === baseUrl.origin)) return allowed;

  const counts = new Map();
  for (const link of links) {
    if (!link.hostname.startsWith("docs.")) continue;
    counts.set(link.origin, (counts.get(link.origin) || 0) + 1);
  }

  const [origin, count] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0] || [];
  if (origin && count >= 3) allowed.add(origin);
  return allowed;
}

function stripTrailingUrlPunctuation(href) {
  let cleanHref = href.replace(/[.,;:!?]+$/, "");
  while (
    cleanHref.endsWith(")") &&
    (cleanHref.match(/\)/g) || []).length > (cleanHref.match(/\(/g) || []).length
  ) {
    cleanHref = cleanHref.slice(0, -1);
  }
  return cleanHref;
}

function isAssetPath(path) {
  return [
    ".zip",
    ".tar.gz",
    ".dmg",
    ".pkg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".js",
    ".woff",
    ".woff2",
  ].some((extension) => path.endsWith(extension));
}
