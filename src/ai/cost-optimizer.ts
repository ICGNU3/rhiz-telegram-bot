import { modelSelector } from './model-registry';
import config from '../utils/config';
import logger from '../utils/logger';

interface CostMetrics {
  tokensUsed: number;
  costPerToken: number;
  totalCost: number;
  modelUsed: string;
  timestamp: Date;
}

interface OptimizationResult {
  optimized: boolean;
  costSavings: number;
  modelChanged: boolean;
  newModel: string;
  reason: string;
}

class CostOptimizer {
  private costHistory: CostMetrics[] = [];
  private dailyBudget: number = 10.0; // $10 daily budget
  private monthlyBudget: number = 100.0; // $100 monthly budget

  /**
   * Optimize model selection based on cost and performance
   */
  async optimizeModelSelection(task: string, complexity: 'simple' | 'medium' | 'complex'): Promise<OptimizationResult> {
    try {
      const currentModel = config.openai.model;
      const optimalModel = modelSelector.getOptimalModel(task, complexity);
      
      // Check if we should switch to a cheaper model
      if (this.shouldUseCheaperModel(task, complexity)) {
        const cheaperModel = this.getCheaperModel(currentModel);
        
        if (cheaperModel && cheaperModel !== currentModel) {
          return {
            optimized: true,
            costSavings: this.calculateCostSavings(currentModel, cheaperModel),
            modelChanged: true,
            newModel: cheaperModel,
            reason: 'Cost optimization: switching to cheaper model'
          };
        }
      }

      // Check if we should use the optimal model
      if (optimalModel !== currentModel) {
        return {
          optimized: true,
          costSavings: this.calculateCostSavings(currentModel, optimalModel),
          modelChanged: true,
          newModel: optimalModel,
          reason: 'Performance optimization: using optimal model for task'
        };
      }

      return {
        optimized: false,
        costSavings: 0,
        modelChanged: false,
        newModel: currentModel,
        reason: 'No optimization needed'
      };
    } catch (error) {
      logger.error('Error in model optimization:', error);
      return {
        optimized: false,
        costSavings: 0,
        modelChanged: false,
        newModel: config.openai.model,
        reason: 'Optimization failed, using default model'
      };
    }
  }

  /**
   * Record cost metrics for analysis
   */
  recordCostMetrics(metrics: Omit<CostMetrics, 'timestamp'>): void {
    this.costHistory.push({
      ...metrics,
      timestamp: new Date()
    });

    // Keep only last 1000 entries
    if (this.costHistory.length > 1000) {
      this.costHistory = this.costHistory.slice(-1000);
    }
  }

  /**
   * Get cost analysis for the current period
   */
  getCostAnalysis(): {
    dailyCost: number;
    monthlyCost: number;
    averageCostPerRequest: number;
    totalRequests: number;
    budgetUtilization: number;
  } {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyCosts = this.costHistory.filter(m => m.timestamp > oneDayAgo);
    const monthlyCosts = this.costHistory.filter(m => m.timestamp > oneMonthAgo);

    const dailyCost = dailyCosts.reduce((sum, m) => sum + m.totalCost, 0);
    const monthlyCost = monthlyCosts.reduce((sum, m) => sum + m.totalCost, 0);
    const totalRequests = this.costHistory.length;
    const averageCostPerRequest = totalRequests > 0 ? 
      this.costHistory.reduce((sum, m) => sum + m.totalCost, 0) / totalRequests : 0;

    return {
      dailyCost,
      monthlyCost,
      averageCostPerRequest,
      totalRequests,
      budgetUtilization: (dailyCost / this.dailyBudget) * 100
    };
  }

  /**
   * Check if we're approaching budget limits
   */
  isBudgetWarning(): boolean {
    const analysis = this.getCostAnalysis();
    return analysis.budgetUtilization > 80; // Warning at 80% of daily budget
  }

  /**
   * Check if we should use a cheaper model
   */
  private shouldUseCheaperModel(task: string, complexity: string): boolean {
    const analysis = this.getCostAnalysis();
    
    // Use cheaper model if:
    // 1. We're over 70% of daily budget
    // 2. Task is simple or medium complexity
    // 3. Not a critical task
    return analysis.budgetUtilization > 70 && 
           (complexity === 'simple' || complexity === 'medium') &&
           !this.isCriticalTask(task);
  }

  /**
   * Get a cheaper alternative model
   */
  private getCheaperModel(currentModel: string): string | null {
    const modelCosts: Record<string, number> = {
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.002,
      'gpt-3.5-turbo-16k': 0.003
    };

    const currentCost = modelCosts[currentModel] || 0.01;
    
    // Find cheaper model
    for (const [model, cost] of Object.entries(modelCosts)) {
      if (cost < currentCost && model !== currentModel) {
        return model;
      }
    }

    return null;
  }

  /**
   * Calculate cost savings between models
   */
  private calculateCostSavings(currentModel: string, newModel: string): number {
    const modelCosts: Record<string, number> = {
      'gpt-4': 0.03,
      'gpt-4-turbo': 0.01,
      'gpt-3.5-turbo': 0.002,
      'gpt-3.5-turbo-16k': 0.003
    };

    const currentCost = modelCosts[currentModel] || 0.01;
    const newCost = modelCosts[newModel] || 0.01;
    
    return currentCost - newCost;
  }

  /**
   * Check if task is critical (shouldn't be optimized for cost)
   */
  private isCriticalTask(task: string): boolean {
    const criticalTasks = [
      'security',
      'authentication',
      'payment',
      'user_data',
      'admin',
      'emergency'
    ];

    return criticalTasks.some(critical => 
      task.toLowerCase().includes(critical)
    );
  }

  /**
   * Generate cost optimization report
   */
  generateOptimizationReport(): string {
    const analysis = this.getCostAnalysis();
    const optimization = this.getOptimizationSuggestions();

    return `
📊 **Cost Optimization Report**

💰 **Current Costs:**
• Daily: $${analysis.dailyCost.toFixed(4)}
• Monthly: $${analysis.monthlyCost.toFixed(4)}
• Per Request: $${analysis.averageCostPerRequest.toFixed(6)}
• Total Requests: ${analysis.totalRequests}

🎯 **Budget Status:**
• Daily Budget: $${this.dailyBudget}
• Utilization: ${analysis.budgetUtilization.toFixed(1)}%
• Status: ${analysis.budgetUtilization > 80 ? '⚠️ Warning' : '✅ Good'}

💡 **Optimization Suggestions:**
${optimization.map(s => `• ${s}`).join('\n')}
    `.trim();
  }

  /**
   * Get optimization suggestions
   */
  private getOptimizationSuggestions(): string[] {
    const analysis = this.getCostAnalysis();
    const suggestions: string[] = [];

    if (analysis.budgetUtilization > 80) {
      suggestions.push('Consider switching to GPT-3.5-turbo for simple tasks');
    }

    if (analysis.averageCostPerRequest > 0.01) {
      suggestions.push('Review high-cost requests and optimize prompts');
    }

    if (analysis.totalRequests > 1000) {
      suggestions.push('Implement request caching to reduce API calls');
    }

    return suggestions;
  }
}

export default new CostOptimizer();