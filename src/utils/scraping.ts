export async function scrapeUrl(url: string): Promise<string> {
  const response = await fetch('/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, action: 'scrape' }),
  });

  const data = await response.json();

  // Check if we have the expected response structure
  if (!data.success) {
    const errorMsg = data.error || 'Scraping failed - unknown error';
    throw new Error(errorMsg);
  }

  const markdown = data.data?.markdown || '';
  return markdown;
}
