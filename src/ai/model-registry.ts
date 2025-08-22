import logger from '../utils/logger';

// Model capability definitions
interface ModelCapabilities {
  contextWindow: number;
  costPer1kTokens: { input: number; output: number };
  quality: 'basic' | 'standard' | 'advanced' | 'premium';
  features: {
    json: boolean;
    functions: boolean;
    vision: boolean;
    streaming: boolean;
  };
  speed: 'fast' | 'medium' | 'slow';
}

// Model registry with capabilities
export const MODEL_REGISTRY: Record<string, ModelCapabilities> = {
  // GPT-4 models (for complex tasks)
  'gpt-4-turbo-preview': {
    contextWindow: 128000,
    costPer1kTokens: { input: 0.01, output: 0.03 },
    quality: 'premium',
    features: { json: true, functions: true, vision: true, streaming: true },
    speed: 'medium'
  },
  
  // GPT-3.5 Turbo (default for most tasks)
  'gpt-3.5-turbo': {
    contextWindow: 16385,
    costPer1kTokens: { input: 0.0005, output: 0.0015 },
    quality: 'standard',
    features: { json: true, functions: true, vision: false, streaming: true },
    speed: 'fast'
  },
  
  // Embedding models
  'text-embedding-3-small': {
    contextWindow: 8191,
    costPer1kTokens: { input: 0.00002, output: 0 },
    quality: 'standard',
    features: { json: false, functions: false, vision: false, streaming: false },
    speed: 'fast'
  },
  'text-embedding-3-large': {
    contextWindow: 8191,
    costPer1kTokens: { input: 0.00013, output: 0 },
    quality: 'advanced',
    features: { json: false, functions: false, vision: false, streaming: false },
    speed: 'fast'
  }
};

// Task complexity definitions
export type TaskComplexity = 'simple' | 'moderate' | 'complex' | 'critical';

export interface TaskRequirements {
  complexity: TaskComplexity;
  needsJson?: boolean;
  needsFunctions?: boolean;
  needsVision?: boolean;
  maxResponseTokens?: number;
  preferSpeed?: boolean;
  preferQuality?: boolean;
}

export class ModelSelector {
  private modelOverrides: Map<string, string> = new Map();
  private performanceMetrics: Map<string, { avgLatency: number; successRate: number }> = new Map();
  
  /**
   * Get the optimal model for a specific task
   */
  getOptimalModel(task: string, complexity: 'simple' | 'medium' | 'complex' = 'medium'): string {
    try {
      // Check if we have performance data for this task
      const taskPerformance = this.performanceData.get(task);
      
      if (taskPerformance && taskPerformance.length > 0) {
        // Use the best performing model for this task
        const bestModel = taskPerformance.reduce((best, current) => 
          current.successRate > best.successRate ? current : best
        );
        
        if (bestModel.successRate > 0.8) {
          return bestModel.model;
        }
      }

      // Fallback to complexity-based selection
      return this.getModelByComplexity(complexity);
    } catch (error) {
      logger.error('Error in model selection, using fallback:', error);
      return this.getModelByComplexity(complexity);
    }
  }

  /**
   * Compare two models for a specific task
   */
  compareModels(_nameA: string, _nameB: string, task: string): {
    modelA: any;
    modelB: any;
    recommendation: string;
  } {
    const modelA = this.getModelPerformance(_nameA, task);
    const modelB = this.getModelPerformance(_nameB, task);
    
    let recommendation = 'Both models perform similarly';
    
    if (modelA.successRate > modelB.successRate + 0.1) {
      recommendation = `${_nameA} performs significantly better`;
    } else if (modelB.successRate > modelA.successRate + 0.1) {
      recommendation = `${_nameB} performs significantly better`;
    } else if (modelA.avgResponseTime < modelB.avgResponseTime * 0.8) {
      recommendation = `${_nameA} is faster`;
    } else if (modelB.avgResponseTime < modelA.avgResponseTime * 0.8) {
      recommendation = `${_nameB} is faster`;
    }
    
    return { modelA, modelB, recommendation };
  }
  
  /**
   * Get default requirements based on task type
   */
  private getDefaultRequirements(task: string): TaskRequirements {
    const taskMap: Record<string, TaskRequirements> = {
      // Simple tasks - use fast, cheap models (GPT-3.5 Turbo)
      'intent_detection': {
        complexity: 'simple',
        preferSpeed: true,
        needsJson: true
      },
      'sentiment_analysis': {
        complexity: 'simple',
        preferSpeed: true,
        needsJson: true
      },
      'basic_response': {
        complexity: 'simple',
        preferSpeed: true
      },
      'contact_validation': {
        complexity: 'simple',
        needsJson: true,
        preferSpeed: true
      },
      
      // Moderate tasks - balance quality and cost (GPT-3.5 Turbo)
      'contact_extraction': {
        complexity: 'moderate',
        needsJson: true,
        preferQuality: true
      },
      'goal_analysis': {
        complexity: 'moderate',
        needsJson: true
      },
      'follow_up_generation': {
        complexity: 'moderate',
        preferQuality: true
      },
      'reminder_creation': {
        complexity: 'moderate',
        needsJson: true
      },
      
      // Complex tasks - use GPT-4 for premium quality
      'relationship_scoring': {
        complexity: 'complex',
        needsJson: true,
        preferQuality: true
      },
      'introduction_generation': {
        complexity: 'complex',
        maxResponseTokens: 300,
        preferQuality: true
      },
      'conversation_analysis': {
        complexity: 'complex',
        needsJson: true,
        preferQuality: true
      },
      'network_insights': {
        complexity: 'complex',
        needsJson: true,
        preferQuality: true
      },
      
      // Critical tasks - use best available (GPT-4)
      'network_analysis': {
        complexity: 'critical',
        needsJson: true,
        preferQuality: true
      },
      'strategic_planning': {
        complexity: 'critical',
        needsJson: true,
        preferQuality: true
      }
    };
    
    return taskMap[task] || {
      complexity: 'moderate',
      needsJson: false
    };
  }
  
  /**
   * Set a manual override for testing new models
   */
  setModelOverride(task: string, model: string): void {
    this.modelOverrides.set(task, model);
    logger.info(`Set model override for ${task}: ${model}`);
  }
  
  /**
   * Clear model override
   */
  clearModelOverride(task: string): void {
    this.modelOverrides.delete(task);
    logger.info(`Cleared model override for ${task}`);
  }
  
  /**
   * Record performance metrics for continuous improvement
   */
  recordPerformance(model: string, latency: number, success: boolean): void {
    const current = this.performanceMetrics.get(model) || { avgLatency: 0, successRate: 1 };
    
    // Simple moving average
    const newAvgLatency = (current.avgLatency * 0.9) + (latency * 0.1);
    const newSuccessRate = (current.successRate * 0.95) + (success ? 0.05 : 0);
    
    this.performanceMetrics.set(model, {
      avgLatency: newAvgLatency,
      successRate: newSuccessRate
    });
  }
  
  /**
   * Get performance report for monitoring
   */
  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    this.performanceMetrics.forEach((metrics, model) => {
      report[model] = {
        avgLatency: Math.round(metrics.avgLatency),
        successRate: (metrics.successRate * 100).toFixed(1) + '%'
      };
    });
    
    return report;
  }
}

// Singleton instance
export const modelSelector = new ModelSelector();

// Backward compatibility wrapper
export function getModelForTask(task: string, complexity?: 'low' | 'medium' | 'high'): string {
  // Map old complexity to new system
  const complexityMap = {
    'low': 'simple' as TaskComplexity,
    'medium': 'moderate' as TaskComplexity,
    'high': 'complex' as TaskComplexity
  };
  
  return modelSelector.getOptimalModel(task, {
    complexity: complexityMap[complexity || 'medium']
  });
}