import OpenAI from 'openai';
import config from '../utils/config';
import logger from '../utils/logger';
import gpt4Service from './gpt4';

const openai = new OpenAI({ apiKey: config.openai.apiKey });

export class EnhancedAIFeatures {
  
  // Sentiment Analysis for relationship health tracking
  async analyzeSentiment(text: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
    emotions: string[];
    relationship_indicators: {
      enthusiasm: number;
      professionalism: number;
      warmth: number;
    };
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{
          role: 'system',
          content: `Analyze the sentiment and emotional indicators in this professional communication.
          Focus on relationship health indicators:
          - Overall sentiment (positive/neutral/negative)
          - Confidence level (0-1)
          - Detected emotions
          - Professional relationship indicators (enthusiasm, professionalism, warmth) on 0-100 scale
          
          Respond in JSON format.`
        }, {
          role: 'user',
          content: text
        }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      logger.error('Error analyzing sentiment:', error);
      return {
        sentiment: 'neutral',
        confidence: 0,
        emotions: [],
        relationship_indicators: { enthusiasm: 50, professionalism: 50, warmth: 50 }
      };
    }
  }

  // Network Graph Analysis for relationship mapping
  async analyzeNetworkConnections(contacts: any[]): Promise<{
    clusters: Array<{
      name: string;
      contacts: string[];
      strength: number;
      industry: string;
    }>;
    bridges: Array<{
      contact: string;
      connections: number;
      influence_score: number;
    }>;
    opportunities: Array<{
      type: string;
      description: string;
      contacts_involved: string[];
      potential_value: number;
    }>;
  }> {
    try {
      const networkData = contacts.map(c => ({
        name: c.name,
        company: c.company,
        title: c.title,
        industry: this.extractIndustry(c.company, c.title),
        connections: c.mutual_connections || [],
        strength: c.relationship_score || 0
      }));

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{
          role: 'system',
          content: `Analyze this professional network for relationship clusters, key bridge contacts, and opportunities.
          
          Identify:
          1. Clusters of related contacts (by industry, company, mutual connections)
          2. Bridge contacts who connect different clusters
          3. Networking opportunities and potential introductions
          
          Respond in JSON format with the specified structure.`
        }, {
          role: 'user',
          content: JSON.stringify(networkData)
        }],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message?.content || '{"clusters":[],"bridges":[],"opportunities":[]}');
    } catch (error) {
      logger.error('Error analyzing network connections:', error);
      return { clusters: [], bridges: [], opportunities: [] };
    }
  }

  // Conversation Intelligence for follow-up suggestions
  async generateFollowUpStrategy(contact: any, conversation: string, context: any): Promise<{
    priority: 'high' | 'medium' | 'low';
    timing: string;
    method: 'call' | 'email' | 'linkedin' | 'in_person' | 'text';
    suggested_content: string;
    key_points_to_mention: string[];
    goals: string[];
    next_steps: string[];
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{
          role: 'system',
          content: `Generate a strategic follow-up plan based on the conversation and relationship context.
          
          Consider:
          - Relationship strength and history
          - Conversation content and commitments made
          - Professional goals and mutual interests
          - Optimal timing and communication method
          - Specific talking points and next steps
          
          Respond in JSON format.`
        }, {
          role: 'user',
          content: `Contact: ${contact.name} (${contact.title} at ${contact.company})
          Relationship Score: ${contact.relationship_score}/100
          Recent Conversation: ${conversation}
          Context: ${JSON.stringify(context)}`
        }],
        temperature: 0.6,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      logger.error('Error generating follow-up strategy:', error);
      return {
        priority: 'medium',
        timing: '1 week',
        method: 'email',
        suggested_content: 'Follow up on our recent conversation',
        key_points_to_mention: [],
        goals: [],
        next_steps: []
      };
    }
  }

  // Smart Introduction Matching using ML
  async findOptimalIntroductions(userGoals: any[], contacts: any[]): Promise<{
    high_value_intros: Array<{
      from_contact: any;
      to_contact: any;
      mutual_benefit: string;
      introduction_script: string;
      confidence_score: number;
      timing_recommendation: string;
    }>;
    goal_specific_matches: Array<{
      goal: string;
      recommended_contacts: any[];
      introduction_strategy: string;
    }>;
  }> {
    try {
      // Create embeddings for goals and contact profiles
      const goalEmbeddings = await Promise.all(
        userGoals.map(goal => gpt4Service.createEmbedding(goal.description))
      );

      const contactEmbeddings = await Promise.all(
        contacts.map(contact => 
          gpt4Service.createEmbedding(`${contact.name} ${contact.title} ${contact.company} ${contact.notes}`)
        )
      );

      // Use AI to analyze combinations
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{
          role: 'system',
          content: `Analyze contacts and goals to suggest optimal introductions.
          
          For each potential introduction, consider:
          - Mutual benefit and value creation
          - Professional alignment and interests
          - Relationship strength with both parties
          - Timing and context appropriateness
          - Introduction success probability
          
          Respond in JSON format.`
        }, {
          role: 'user',
          content: `Goals: ${JSON.stringify(userGoals)}
          Contacts: ${JSON.stringify(contacts.map(c => ({
            name: c.name,
            title: c.title,
            company: c.company,
            relationship_score: c.relationship_score,
            notes: c.notes,
            interests: c.interests || []
          })))}`
        }],
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message?.content || '{"high_value_intros":[],"goal_specific_matches":[]}');
    } catch (error) {
      logger.error('Error finding optimal introductions:', error);
      return { high_value_intros: [], goal_specific_matches: [] };
    }
  }

  // Conversation Summarization for relationship history
  async summarizeConversationHistory(interactions: any[]): Promise<{
    relationship_timeline: Array<{
      date: string;
      event: string;
      importance: 'high' | 'medium' | 'low';
      sentiment: string;
    }>;
    key_topics: string[];
    relationship_progression: string;
    mutual_interests: string[];
    professional_synergies: string[];
    recommendations: string[];
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{
          role: 'system',
          content: `Analyze conversation history to create a comprehensive relationship summary.
          
          Extract:
          - Key events and milestones in the relationship
          - Important topics and themes discussed
          - Relationship progression and changes over time
          - Mutual interests and professional synergies
          - Recommendations for strengthening the relationship
          
          Respond in JSON format.`
        }, {
          role: 'user',
          content: JSON.stringify(interactions)
        }],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      logger.error('Error summarizing conversation history:', error);
      return {
        relationship_timeline: [],
        key_topics: [],
        relationship_progression: '',
        mutual_interests: [],
        professional_synergies: [],
        recommendations: []
      };
    }
  }

  // Predictive Relationship Analytics
  async predictRelationshipTrends(contact: any, historicalData: any[]): Promise<{
    trend_direction: 'strengthening' | 'stable' | 'weakening';
    predicted_score_change: number;
    risk_factors: string[];
    growth_opportunities: string[];
    recommended_actions: Array<{
      action: string;
      expected_impact: number;
      timeline: string;
    }>;
    confidence: number;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: config.openai.model,
        messages: [{
          role: 'system',
          content: `Predict relationship trajectory based on historical interaction patterns.
          
          Analyze:
          - Interaction frequency trends
          - Sentiment changes over time
          - Response patterns and engagement
          - Professional alignment evolution
          - Risk factors and warning signs
          - Growth opportunities and recommendations
          
          Respond in JSON format.`
        }, {
          role: 'user',
          content: `Current Contact: ${JSON.stringify(contact)}
          Historical Data: ${JSON.stringify(historicalData)}`
        }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      logger.error('Error predicting relationship trends:', error);
      return {
        trend_direction: 'stable',
        predicted_score_change: 0,
        risk_factors: [],
        growth_opportunities: [],
        recommended_actions: [],
        confidence: 0
      };
    }
  }

  private extractIndustry(company: string, title: string): string {
    // Simple industry extraction logic
    const techTerms = ['tech', 'software', 'developer', 'engineer', 'data', 'ai', 'ml'];
    const financeTerms = ['bank', 'finance', 'investment', 'capital', 'fund'];
    const healthTerms = ['health', 'medical', 'pharma', 'biotech'];
    
    const text = `${company} ${title}`.toLowerCase();
    
    if (techTerms.some(term => text.includes(term))) return 'Technology';
    if (financeTerms.some(term => text.includes(term))) return 'Finance';
    if (healthTerms.some(term => text.includes(term))) return 'Healthcare';
    
    return 'Other';
  }
}

export default new EnhancedAIFeatures();