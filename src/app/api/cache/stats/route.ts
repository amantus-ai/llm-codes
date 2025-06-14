import { NextRequest, NextResponse } from 'next/server';
import { cacheService } from '@/lib/cache/redis-cache';

export async function GET(_request: NextRequest) {
  try {
    // Get cache statistics
    const stats = cacheService.getStats();
    const redisAvailable = cacheService.isRedisAvailable();

    // Format response
    const response = {
      success: true,
      cache: {
        type: redisAvailable ? 'redis' : 'memory-only',
        stats: {
          hits: stats.hits,
          misses: stats.misses,
          errors: stats.errors,
          hitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
          localCacheSize: stats.localCacheSize,
        },
        status: redisAvailable ? 'connected' : 'fallback',
      },
      timestamp: new Date().toISOString(),
    };

    // Add cache headers for this endpoint
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache stats for 1 minute
      },
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve cache statistics',
        cache: { type: 'unknown', status: 'error' },
      },
      { status: 500 }
    );
  }
}
