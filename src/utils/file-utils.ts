import { generateFilename } from './url-utils';
import {
  removeCommonPhrases,
  filterUrlsFromMarkdown,
  filterAvailabilityStrings,
  deduplicateMarkdown,
  is404Page,
} from './content-processing';

interface ProcessingResult {
  url: string;
  content: string;
}

interface DownloadOptions {
  url: string;
  results: ProcessingResult[];
  filterUrls: boolean;
  deduplicateContent: boolean;
  filterAvailability: boolean;
}

export function downloadMarkdown(options: DownloadOptions): void {
  const { url, results, filterUrls, deduplicateContent, filterAvailability } = options;

  // Generate header with attribution
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const validPages = results.filter(
    (r) => r.content && r.content.trim().length > 0 && !is404Page(r.content)
  );
  const notFoundPages = results.filter((r) => r.content && is404Page(r.content));

  const header = `<!--
Downloaded via https://llm.codes by @steipete on ${dateStr} at ${timeStr}
Source URL: ${url}
Total pages processed: ${results.length}
Pages with content: ${validPages.length}
404 pages filtered: ${notFoundPages.length}
URLs filtered: ${filterUrls ? 'Yes' : 'No'}
Content de-duplicated: ${deduplicateContent ? 'Yes' : 'No'}
Availability strings filtered: ${filterAvailability ? 'Yes' : 'No'}
-->

`;

  const processedResults = results
    .filter((r) => r.content && r.content.trim().length > 0 && !is404Page(r.content)) // Only include results with actual content and exclude 404 pages
    .map((r) => {
      let content = r.content;
      content = removeCommonPhrases(content); // Remove common phrases first
      content = filterUrlsFromMarkdown(content, filterUrls);
      content = filterAvailabilityStrings(content, filterAvailability);
      content = deduplicateMarkdown(content, deduplicateContent);
      return { url: r.url, content };
    })
    .filter((r) => r.content && r.content.trim().length > 0); // Filter again after processing

  const content =
    header + processedResults.map((r) => `# ${r.url}\n\n${r.content}\n\n---\n\n`).join('');
  const blob = new Blob([content], { type: 'text/markdown' });
  const downloadUrl = URL.createObjectURL(blob);

  // Generate filename from the original URL
  const filename = generateFilename(url);

  // Create and trigger download
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}
