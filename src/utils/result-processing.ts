import { extractCodeBlocks, formatCodeBlocksAsMarkdown } from "@/utils/code-extraction";
import { filterDocumentation } from "@/utils/documentation-filter";

export interface ProcessingResult {
  url: string;
  content: string;
}

export interface ResultProcessingOptions {
  useCrawlMode: boolean;
  filterUrls: boolean;
  filterAvailability: boolean;
  deduplicateContent: boolean;
  codeBlocksOnly: boolean;
}

export function prepareOutputResults(
  results: ProcessingResult[],
  options: ResultProcessingOptions,
): ProcessingResult[] {
  return results.flatMap((result) => {
    if (!result.content) return [];

    if (options.codeBlocksOnly) {
      const codeBlocks = extractCodeBlocks(result.content);
      if (codeBlocks.length === 0) return [];

      return [
        {
          url: result.url,
          content: formatCodeBlocksAsMarkdown(codeBlocks),
        },
      ];
    }

    let content = result.content;

    if (!options.useCrawlMode) {
      content = filterDocumentation(content, {
        filterUrls: options.filterUrls,
        filterAvailability: options.filterAvailability,
        filterNavigation: true,
        filterLegalBoilerplate: true,
        filterEmptyContent: true,
        filterRedundantTypeAliases: true,
        filterExcessivePlatformNotices: true,
        filterFormattingArtifacts: true,
        deduplicateContent: options.deduplicateContent,
      });
    }

    return [{ url: result.url, content }];
  });
}
