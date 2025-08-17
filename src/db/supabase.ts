import { createClient } from '@supabase/supabase-js';
import config from '../utils/config';
import logger from '../utils/logger';

// Initialize Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Database helper functions
export const db = {
  // User operations
  users: {
    async findByTelegramId(telegramId: number) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        logger.error('Error finding user:', error);
        throw error;
      }
      
      return data;
    },

    async create(userData: any) {
      const { data, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating user:', error);
        throw error;
      }
      
      return data;
    },

    async update(userId: string, updates: any) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      
      if (error) {
        logger.error('Error updating user:', error);
        throw error;
      }
      
      return data;
    },
  },

  // Contact operations
  contacts: {
    async create(contactData: any) {
      const { data, error } = await supabase
        .from('contacts')
        .insert(contactData)
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating contact:', error);
        throw error;
      }
      
      return data;
    },

    async findByUserId(userId: string) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .order('relationship_score', { ascending: false });
      
      if (error) {
        logger.error('Error finding contacts:', error);
        throw error;
      }
      
      return data || [];
    },

    async findById(contactId: string) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      
      if (error) {
        logger.error('Error finding contact:', error);
        throw error;
      }
      
      return data;
    },

    async update(contactId: string, updates: any) {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .select()
        .single();
      
      if (error) {
        logger.error('Error updating contact:', error);
        throw error;
      }
      
      return data;
    },

    async search(userId: string, query: string) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.%${query}%,company.ilike.%${query}%,notes.ilike.%${query}%`)
        .order('relationship_score', { ascending: false });
      
      if (error) {
        logger.error('Error searching contacts:', error);
        throw error;
      }
      
      return data || [];
    },
  },

  // Goal operations (stored in users.goals JSONB)
  goals: {
    async getUserGoals(userId: string) {
      const { data, error } = await supabase
        .from('users')
        .select('goals')
        .eq('id', userId)
        .single();
      
      if (error) {
        logger.error('Error getting user goals:', error);
        throw error;
      }
      
      return data?.goals || [];
    },

    async updateUserGoals(userId: string, goals: any[]) {
      const { data, error } = await supabase
        .from('users')
        .update({ goals })
        .eq('id', userId)
        .select('goals')
        .single();
      
      if (error) {
        logger.error('Error updating user goals:', error);
        throw error;
      }
      
      return data?.goals || [];
    },
  },

  // Introduction operations
  introductions: {
    async create(introData: any) {
      const { data, error } = await supabase
        .from('introductions')
        .insert(introData)
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating introduction:', error);
        throw error;
      }
      
      return data;
    },

    async findPending(userId: string) {
      const { data, error } = await supabase
        .from('introductions')
        .select(`
          *,
          from_contact:contacts!from_contact_id(*),
          to_contact:contacts!to_contact_id(*)
        `)
        .eq('user_id', userId)
        .in('status', ['suggested', 'drafted'])
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error('Error finding introductions:', error);
        throw error;
      }
      
      return data || [];
    },

    async updateStatus(introId: string, status: string, actualMessage?: string) {
      const updates: any = { status };
      if (actualMessage) updates.actual_message = actualMessage;
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('introductions')
        .update(updates)
        .eq('id', introId)
        .select()
        .single();
      
      if (error) {
        logger.error('Error updating introduction:', error);
        throw error;
      }
      
      return data;
    },
  },

  // Voice message operations
  voiceMessages: {
    async create(messageData: any) {
      const { data, error } = await supabase
        .from('voice_messages')
        .insert(messageData)
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating voice message:', error);
        throw error;
      }
      
      return data;
    },

    async markProcessed(messageId: string, transcript: string, intent?: string, entities?: any) {
      const { data, error } = await supabase
        .from('voice_messages')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          transcript,
          intent,
          entities,
        })
        .eq('id', messageId)
        .select()
        .single();
      
      if (error) {
        logger.error('Error updating voice message:', error);
        throw error;
      }
      
      return data;
    },
  },

  // Interaction operations
  interactions: {
    async create(interactionData: any) {
      const { data, error } = await supabase
        .from('interactions')
        .insert(interactionData)
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating interaction:', error);
        throw error;
      }
      
      return data;
    },

    async findByContact(contactId: string, limit = 10) {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        logger.error('Error finding interactions:', error);
        throw error;
      }
      
      return data || [];
    },
  },


};

export default db;
