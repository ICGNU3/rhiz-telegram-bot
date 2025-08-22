import logger from '../utils/logger';

interface ModelCapabilities {
  quality: 'basic' | 'standard' | 'advanced' | 'premium';
  speed: 'fast' | 'medium' | 'slow';
  costPer1kTokens: {
    input: number;
    output: number;
  };
  features: {
    json: boolean;
    functions: boolean;
    vision: boolean;
  };
}

interface TaskRequirements {
  complexity: 'simple' | 'medium' | 'complex';
  needsJson?: boolean;
  needsFunctions?: boolean;
  needsVision?: boolean;
  preferSpeed?: boolean;
  preferQuality?: boolean;
}

interface ModelPerformance {
  model: string;
  task: string;
  successRate: number;
  avgResponseTime: number;
  lastUsed: Date;
}

export const MODEL_REGISTRY: Record<string, ModelCapabilities> = {
  'gpt-4': {
    quality: 'premium',
    speed: 'slow',
    costPer1kTokens: { input: 0.03, output: 0.06 },
    features: { json: true, functions: true, vision: true }
  },
  'gpt-4-turbo': {
    quality: 'advanced',
    speed: 'medium',
    costPer1kTokens: { input: 0.01, output: 0.03 },
    features: { json: true, functions: true, vision: true }
  },
  'gpt-3.5-turbo': {
    quality: 'standard',
    speed: 'fast',
    costPer1kTokens: { input: 0.0015, output: 0.002 },
    features: { json: true, functions: true, vision: false }
  },
  'gpt-3.5-turbo-16k': {
    quality: 'standard',
    speed: 'fast',
    costPer1kTokens: { input: 0.003, output: 0.004 },
    features: { json: true, functions: true, vision: false }
  }
};

class ModelSelector {
  private performanceData: Map<string, ModelPerformance[]> = new Map();
  private modelOverrides: Map<string, string> = new Map();

  /**
   * Get the optimal model for a specific task
   */
  getOptimalModel(task: string, complexity: 'simple' | 'medium' | 'complex' = 'medium'): string {
    try {
      // Check if we have performance data for this task
      const taskPerformance = this.performanceData.get(task);
      
      if (taskPerformance && taskPerformance.length > 0) {
        // Use the best performing model for this task
        const bestModel = taskPerformance.reduce((best: ModelPerformance, current: ModelPerformance) => 
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
   * Get model by complexity level
   */
  private getModelByComplexity(complexity: 'simple' | 'medium' | 'complex'): string {
    switch (complexity) {
      case 'simple':
        return 'gpt-3.5-turbo';
      case 'medium':
        return 'gpt-3.5-turbo';
      case 'complex':
        return 'gpt-4-turbo';
      default:
        return 'gpt-3.5-turbo';
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
   * Get model performance data
   */
  private getModelPerformance(modelName: string, task: string): ModelPerformance {
    const taskPerformance = this.performanceData.get(task);
    const modelPerformance = taskPerformance?.find(p => p.model === modelName);
    
    if (modelPerformance) {
      return modelPerformance;
    }
    
    // Return default performance if no data available
    return {
      model: modelName,
      task,
      successRate: 0.5,
      avgResponseTime: 2000,
      lastUsed: new Date()
    };
  }

  /**
   * Record performance metrics for a model
   */
  recordPerformance(model: string, task: string, responseTime: number, success: boolean): void {
    try {
      const taskPerformance = this.performanceData.get(task) || [];
      const existingIndex = taskPerformance.findIndex(p => p.model === model);
      
      const performance: ModelPerformance = {
        model,
        task,
        successRate: success ? 1.0 : 0.0,
        avgResponseTime: responseTime,
        lastUsed: new Date()
      };
      
      if (existingIndex >= 0) {
        // Update existing performance data
        const existing = taskPerformance[existingIndex];
        const totalAttempts = existing.successRate * 10 + (success ? 1 : 0); // Estimate total attempts
        const newSuccessRate = (existing.successRate * 10 + (success ? 1 : 0)) / (totalAttempts + 1);
        const newAvgResponseTime = (existing.avgResponseTime + responseTime) / 2;
        
        taskPerformance[existingIndex] = {
          ...performance,
          successRate: newSuccessRate,
          avgResponseTime: newAvgResponseTime
        };
      } else {
        // Add new performance data
        taskPerformance.push(performance);
      }
      
      this.performanceData.set(task, taskPerformance);
    } catch (error) {
      logger.error('Error recording performance:', error);
    }
  }

  /**
   * Get performance report for all models
   */
  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};
    
    for (const [task, performances] of this.performanceData.entries()) {
      report[task] = performances.map(p => ({
        model: p.model,
        successRate: p.successRate,
        avgResponseTime: p.avgResponseTime,
        lastUsed: p.lastUsed.toISOString()
      }));
    }
    
    return report;
  }

  /**
   * Set model override for testing
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
   * Get model capabilities
   */
  getModelCapabilities(modelName: string): ModelCapabilities | null {
    return MODEL_REGISTRY[modelName] || null;
  }

  /**
   * Get all available models
   */
  getAvailableModels(): string[] {
    return Object.keys(MODEL_REGISTRY);
  }

  /**
   * Check if model supports specific features
   */
  supportsFeature(modelName: string, feature: keyof ModelCapabilities['features']): boolean {
    const capabilities = this.getModelCapabilities(modelName);
    return capabilities?.features[feature] || false;
  }

  /**
   * Get cost estimate for a model
   */
  getCostEstimate(modelName: string, inputTokens: number, outputTokens: number): number {
    const capabilities = this.getModelCapabilities(modelName);
    if (!capabilities) return 0;
    
    const inputCost = (inputTokens / 1000) * capabilities.costPer1kTokens.input;
    const outputCost = (outputTokens / 1000) * capabilities.costPer1kTokens.output;
    
    return inputCost + outputCost;
  }
}

export const modelSelector = new ModelSelector();

// Legacy function for backward compatibility
export function getModelForTask(task: string, complexity: 'simple' | 'medium' | 'complex' = 'medium'): string {
  return modelSelector.getOptimalModel(task, complexity);
}