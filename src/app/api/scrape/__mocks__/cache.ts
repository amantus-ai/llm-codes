// Mock cache for testing
export const cache = new Map<string, { content: string; timestamp: number }>();

export const clearCache = () => cache.clear();
