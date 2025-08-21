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
   * Get the best model for a specific task
   * Falls back gracefully if optimal model unavailable
   */
  getOptimalModel(task: string, requirements?: TaskRequirements): string {
    // Check for manual override first (for testing new models)
    const override = this.modelOverrides.get(task);
    if (override) {
      logger.info(`Using override model ${override} for task ${task}`);
      return override;
    }
    
    // Default requirements if not specified
    const req = requirements || this.getDefaultRequirements(task);
    
    // Map complexity to quality needs
    const qualityMap: Record<TaskComplexity, ModelCapabilities['quality'][]> = {
      simple: ['basic', 'standard'],
      moderate: ['standard', 'advanced'],
      complex: ['advanced', 'premium'],
      critical: ['premium']
    };
    
    const acceptableQualities = qualityMap[req.complexity];
    
    // Filter and sort models by requirements
    const candidates = Object.entries(MODEL_REGISTRY)
      .filter(([name, caps]) => {
        // Filter by quality
        if (!acceptableQualities.includes(caps.quality)) return false;
        
        // Filter by required features
        if (req.needsJson && !caps.features.json) return false;
        if (req.needsFunctions && !caps.features.functions) return false;
        if (req.needsVision && !caps.features.vision) return false;
        
        return true;
      })
      .sort(([nameA, capsA], [nameB, capsB]) => {
        // Sort by preference
        if (req.preferSpeed) {
          const speedOrder = { fast: 0, medium: 1, slow: 2 };
          return speedOrder[capsA.speed] - speedOrder[capsB.speed];
        }
        
        if (req.preferQuality) {
          const qualityOrder = { premium: 0, advanced: 1, standard: 2, basic: 3 };
          return qualityOrder[capsA.quality] - qualityOrder[capsB.quality];
        }
        
        // Default: balance cost and quality
        const costA = capsA.costPer1kTokens.input + capsA.costPer1kTokens.output;
        const costB = capsB.costPer1kTokens.input + capsB.costPer1kTokens.output;
        return costA - costB;
      });
    
    // Return best candidate or safe fallback
    const selected = candidates[0]?.[0] || 'gpt-3.5-turbo';
    
    logger.debug(`Selected model ${selected} for task ${task} with complexity ${req.complexity}`);
    return selected;
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