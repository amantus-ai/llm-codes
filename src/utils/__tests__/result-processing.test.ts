import { describe, expect, it } from "vitest";
import { prepareOutputResults } from "../result-processing";

const baseOptions = {
  useCrawlMode: false,
  filterUrls: true,
  filterAvailability: true,
  deduplicateContent: true,
  codeBlocksOnly: false,
};

describe("prepareOutputResults", () => {
  it("extracts only code blocks and skips pages without code", () => {
    const results = prepareOutputResults(
      [
        {
          url: "https://docs.example.com/intro",
          content: "# Intro\n\nNo examples here.",
        },
        {
          url: "https://docs.example.com/setup",
          content: "# Setup\n\n```ts\nconst answer = 42;\n```\n\nMore prose.",
        },
      ],
      {
        ...baseOptions,
        codeBlocksOnly: true,
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0].url).toBe("https://docs.example.com/setup");
    expect(results[0].content).toContain("# Code Examples");
    expect(results[0].content).toContain("```ts\nconst answer = 42;\n```");
    expect(results[0].content).not.toContain("More prose");
    expect(results[0].content).not.toContain("No code blocks found");
  });

  it("keeps crawl-mode content as-is when code-only is disabled", () => {
    const results = prepareOutputResults(
      [
        {
          url: "https://docs.example.com/",
          content: "# Docs\n\n[linked text](https://example.com)",
        },
      ],
      {
        ...baseOptions,
        useCrawlMode: true,
      },
    );

    expect(results).toEqual([
      {
        url: "https://docs.example.com/",
        content: "# Docs\n\n[linked text](https://example.com)",
      },
    ]);
  });

  it("applies standard filtering outside crawl mode", () => {
    const results = prepareOutputResults(
      [
        {
          url: "https://docs.example.com/",
          content: "# Docs\n\nSee [install](https://docs.example.com/install).",
        },
      ],
      baseOptions,
    );

    expect(results[0].content).toContain("See install.");
    expect(results[0].content).not.toContain("https://docs.example.com/install");
  });
});
