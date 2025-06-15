import { Agent } from 'undici';

// Create an HTTP/2-enabled agent for improved performance
const http2Agent = new Agent({
  // Enable HTTP/2 support
  allowH2: true,

  // Connection pooling settings
  pipelining: 10, // Allow up to 10 pipelined requests
  connections: 2, // Maintain 2 connections per origin

  // Keep-alive settings for connection reuse
  keepAliveTimeout: 60000, // 60 seconds
  keepAliveMaxTimeout: 600000, // 10 minutes

  // Timeouts
  headersTimeout: 60000, // 60 seconds for headers
  bodyTimeout: 120000, // 120 seconds for body (increased for large responses)

  // Maximum number of requests per connection
  maxRequestsPerClient: 1000,
});

/**
 * Enhanced fetch function with HTTP/2 support and connection pooling
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @returns Promise<Response>
 */
export async function http2Fetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    // @ts-expect-error - dispatcher is not in the standard fetch types but is supported by undici
    dispatcher: http2Agent,
  });
}

/**
 * Get connection statistics for monitoring
 */
export function getConnectionStats() {
  return http2Agent.stats;
}
