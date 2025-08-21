import logger from '../utils/logger';
import { modelSelector, getModelForTask } from './model-registry';

export interface CostMetrics {
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  apiCalls: {
    count: number;
    cost: number;
  };
  embeddings: {
    count: number;
    cost: number;
  };
  voice: {
    transcription_minutes: number;
    synthesis_characters: number;
    cost: number;
  };
}

export class CostOptimizer {
  private cache = new Map<string, { data: any; timestamp: number; cost: number }>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 1000;
  
  private metrics: CostMetrics = {
    tokenUsage: { input: 0, output: 0, total: 0 },
    apiCalls: { count: 0, cost: 0 },
    embeddings: { count: 0, cost: 0 },
    voice: { transcription_minutes: 0, synthesis_characters: 0, cost: 0 }
  };

  // Token counting for cost estimation
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  // Smart caching with cost awareness
  async getCachedOrExecute<T>(
    key: string,
    operation: () => Promise<T>,
    estimatedCost: number,
    ttl: number = this.CACHE_TTL
  ): Promise<T> {
    const cacheKey = this.hashKey(key);
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < ttl) {
      logger.info(`Cache hit for ${key}, saved $${estimatedCost.toFixed(4)}`);
      return cached.data;
    }
    
    // Execute operation and cache result
    const result = await operation();
    
    // Manage cache size
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldestEntries();
    }
    
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      cost: estimatedCost
    });
    
    // Track cost metrics
    this.metrics.apiCalls.count++;
    this.metrics.apiCalls.cost += estimatedCost;
    
    return result;
  }

  // Optimize prompt length while preserving meaning
  optimizePrompt(prompt: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(prompt);
    
    if (estimatedTokens <= maxTokens) {
      return prompt;
    }
    
    // Progressive optimization strategies
    let optimized = prompt;
    
    // 1. Remove redundant whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();
    
    // 2. Compress common phrases
    const compressions = {
      'Please provide': 'Provide',
      'I would like you to': 'Please',
      'It would be great if you could': 'Please',
      'Could you please': 'Please',
      'I need you to': 'Please'
    };
    
    for (const [long, short] of Object.entries(compressions)) {
      optimized = optimized.replace(new RegExp(long, 'gi'), short);
    }
    
    // 3. If still too long, truncate intelligently
    if (this.estimateTokens(optimized) > maxTokens) {
      const targetLength = Math.floor(optimized.length * (maxTokens / estimatedTokens));
      optimized = optimized.substring(0, targetLength) + '...';
    }
    
    logger.info(`Prompt optimized from ${estimatedTokens} to ${this.estimateTokens(optimized)} tokens`);
    return optimized;
  }

  // Batch operations to reduce API calls
  async batchEmbeddings(texts: string[], batchSize: number = 10): Promise<number[][]> {
    const batches = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
    
    const results: number[][] = [];
    
    for (const batch of batches) {
      // This would integrate with your embedding service
      logger.info(`Processing embedding batch of ${batch.length} items`);
      
      // Simulate batch processing
      const batchResults = await Promise.all(
        batch.map(text => this.simulateEmbedding(text))
      );
      
      results.push(...batchResults);
      
      // Track metrics
      this.metrics.embeddings.count += batch.length;
      this.metrics.embeddings.cost += batch.length * 0.0001; // Estimated cost per embedding
    }
    
    return results;
  }

  // Use cheaper models for simple tasks
  getOptimalModel(task: string, complexity: 'low' | 'medium' | 'high'): string {
    // Now delegates to the new model registry for intelligent selection
    return getModelForTask(task, complexity);
  }

  // Monitor and alert on cost thresholds
  checkCostThresholds(): {
    alerts: string[];
    recommendations: string[];
    currentCost: number;
  } {
    const totalCost = this.metrics.apiCalls.cost + 
                     this.metrics.embeddings.cost + 
                     this.metrics.voice.cost;
    
    const alerts: string[] = [];
    const recommendations: string[] = [];
    
    // Daily cost threshold ($10)
    if (totalCost > 10) {
      alerts.push(`Daily cost threshold exceeded: $${totalCost.toFixed(2)}`);
    }
    
    // High token usage patterns
    if (this.metrics.tokenUsage.total > 100000) {
      recommendations.push('Consider implementing more aggressive prompt optimization');
    }
    
    // Cache hit rate analysis
    const cacheHitRate = this.calculateCacheHitRate();
    if (cacheHitRate < 0.3) {
      recommendations.push('Low cache hit rate detected - review caching strategy');
    }
    
    // Embedding optimization
    if (this.metrics.embeddings.count > 1000) {
      recommendations.push('High embedding usage - consider batch processing and caching');
    }
    
    return {
      alerts,
      recommendations,
      currentCost: totalCost
    };
  }

  // Cost reporting and analytics
  generateCostReport(): {
    daily_cost: number;
    cost_breakdown: CostMetrics;
    optimization_savings: number;
    recommendations: string[];
  } {
    const totalCost = this.metrics.apiCalls.cost + 
                     this.metrics.embeddings.cost + 
                     this.metrics.voice.cost;
    
    const cacheHitRate = this.calculateCacheHitRate();
    const cacheSavings = Array.from(this.cache.values())
      .reduce((total, entry) => total + entry.cost, 0);
    
    return {
      daily_cost: totalCost,
      cost_breakdown: { ...this.metrics },
      optimization_savings: cacheSavings,
      recommendations: [
        `Current cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`,
        `Total savings from caching: $${cacheSavings.toFixed(4)}`,
        'Consider using smaller models for simple tasks',
        'Implement batch processing for embeddings',
        'Monitor token usage patterns'
      ]
    };
  }

  // Reset daily metrics
  resetDailyMetrics(): void {
    this.metrics = {
      tokenUsage: { input: 0, output: 0, total: 0 },
      apiCalls: { count: 0, cost: 0 },
      embeddings: { count: 0, cost: 0 },
      voice: { transcription_minutes: 0, synthesis_characters: 0, cost: 0 }
    };
    
    logger.info('Daily cost metrics reset');
  }

  private hashKey(key: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  private evictOldestEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  private calculateCacheHitRate(): number {
    // This would need to be implemented with actual cache hit tracking
    return 0.65; // Placeholder
  }

  private async simulateEmbedding(text: string): Promise<number[]> {
    // Placeholder for actual embedding generation
    return new Array(1536).fill(0).map(() => Math.random());
  }
}

export default new CostOptimizer();