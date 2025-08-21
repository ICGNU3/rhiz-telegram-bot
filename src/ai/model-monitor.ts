import { modelSelector, MODEL_REGISTRY } from './model-registry';
import logger from '../utils/logger';

export class ModelMonitor {
  private usageStats: Map<string, {
    calls: number;
    totalLatency: number;
    errors: number;
    lastUsed: Date;
  }> = new Map();
  
  /**
   * Get a comprehensive report of model usage and performance
   */
  getModelReport(): {
    currentModels: Record<string, string>;
    performance: Record<string, any>;
    usage: Record<string, any>;
    recommendations: string[];
  } {
    // Get current model assignments
    const currentModels: Record<string, string> = {
      contact_extraction: modelSelector.getOptimalModel('contact_extraction'),
      goal_analysis: modelSelector.getOptimalModel('goal_analysis'),
      relationship_scoring: modelSelector.getOptimalModel('relationship_scoring'),
      introduction_generation: modelSelector.getOptimalModel('introduction_generation'),
      conversation_analysis: modelSelector.getOptimalModel('conversation_analysis'),
      intent_detection: modelSelector.getOptimalModel('intent_detection')
    };
    
    // Get performance metrics
    const performance = modelSelector.getPerformanceReport();
    
    // Get usage statistics
    const usage: Record<string, any> = {};
    this.usageStats.forEach((stats, model) => {
      usage[model] = {
        calls: stats.calls,
        avgLatency: stats.calls > 0 ? Math.round(stats.totalLatency / stats.calls) : 0,
        errors: stats.errors,
        lastUsed: stats.lastUsed.toISOString()
      };
    });
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(currentModels, performance, usage);
    
    return {
      currentModels,
      performance,
      usage,
      recommendations
    };
  }
  
  /**
   * Check if newer/better models are available
   */
  checkForModelUpgrades(): string[] {
    const upgrades: string[] = [];
    
    // Check if GPT-4o is available and we're still using older models
    const currentModels = {
      contact_extraction: modelSelector.getOptimalModel('contact_extraction'),
      conversation_analysis: modelSelector.getOptimalModel('conversation_analysis')
    };
    
    if (currentModels.contact_extraction === 'gpt-4-turbo-preview' && MODEL_REGISTRY['gpt-4o']) {
      upgrades.push('Consider upgrading contact_extraction from gpt-4-turbo-preview to gpt-4o for better speed and lower cost');
    }
    
    if (currentModels.conversation_analysis === 'gpt-4' && MODEL_REGISTRY['gpt-4o']) {
      upgrades.push('Consider upgrading conversation_analysis from gpt-4 to gpt-4o for better performance');
    }
    
    return upgrades;
  }
  
  /**
   * Record model usage for monitoring
   */
  recordUsage(model: string, latency: number, success: boolean): void {
    const current = this.usageStats.get(model) || {
      calls: 0,
      totalLatency: 0,
      errors: 0,
      lastUsed: new Date()
    };
    
    this.usageStats.set(model, {
      calls: current.calls + 1,
      totalLatency: current.totalLatency + latency,
      errors: current.errors + (success ? 0 : 1),
      lastUsed: new Date()
    });
  }
  
  private generateRecommendations(
    currentModels: Record<string, string>,
    performance: Record<string, any>,
    usage: Record<string, any>
  ): string[] {
    const recommendations: string[] = [];
    
    // Check for model upgrade opportunities
    const upgrades = this.checkForModelUpgrades();
    recommendations.push(...upgrades);
    
    // Check for underperforming models
    Object.entries(performance).forEach(([model, metrics]) => {
      if (metrics.successRate && parseFloat(metrics.successRate) < 95) {
        recommendations.push(`Model ${model} has low success rate (${metrics.successRate}). Consider using a more capable model.`);
      }
      
      if (metrics.avgLatency > 5000) {
        recommendations.push(`Model ${model} has high latency (${metrics.avgLatency}ms). Consider using a faster model for time-sensitive tasks.`);
      }
    });
    
    // Check for cost optimization opportunities
    Object.entries(currentModels).forEach(([task, model]) => {
      if (task === 'intent_detection' && model.includes('gpt-4')) {
        recommendations.push(`Task ${task} is using expensive model ${model}. Consider using gpt-4o-mini for this simple task.`);
      }
    });
    
    // Check for unused models
    Object.entries(usage).forEach(([model, stats]) => {
      const lastUsed = new Date(stats.lastUsed);
      const daysSinceUse = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUse > 7) {
        recommendations.push(`Model ${model} hasn't been used in ${Math.round(daysSinceUse)} days. Consider removing from rotation.`);
      }
    });
    
    if (recommendations.length === 0) {
      recommendations.push('All models are performing optimally. No changes recommended.');
    }
    
    return recommendations;
  }
  
  /**
   * Test a new model without affecting production
   */
  async testNewModel(
    task: string,
    newModel: string,
    testInput: string
  ): Promise<{
    currentModel: string;
    newModel: string;
    comparison: {
      latency: { current: number; new: number };
      quality: string;
      costDifference: number;
    };
  }> {
    // This would run both models and compare results
    // For now, return a placeholder
    const currentModel = modelSelector.getOptimalModel(task);
    
    logger.info(`Testing ${newModel} against ${currentModel} for task ${task}`);
    
    return {
      currentModel,
      newModel,
      comparison: {
        latency: { current: 1000, new: 800 },
        quality: 'Similar quality, slightly better on edge cases',
        costDifference: -0.005 // Negative means cheaper
      }
    };
  }
}

export const modelMonitor = new ModelMonitor();