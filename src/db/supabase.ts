import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '../utils/config';
import logger from '../utils/logger';

let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = config.supabase.url || process.env.SUPABASE_URL;
    const key = config.supabase.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      logger.error('Supabase configuration missing:', { 
        hasUrl: !!url, 
        hasKey: !!key,
        envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
      });
      throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    
    supabase = createClient(url, key);
    logger.info('Supabase client initialized successfully');
  }
  return supabase;
}

// Users table operations
const users = {
  async findByTelegramId(telegramId: number) {
    const { data, error } = await getSupabaseClient()
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      logger.error('Error finding user by telegram ID:', error);
      throw error;
    }
    
    return data;
  },

  async create(userData: any) {
    const { data, error } = await getSupabaseClient()
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

  async update(id: string, updates: any) {
    const { data, error } = await getSupabaseClient()
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
    
    return data;
  },

  async findById(id: string) {
    const { data, error } = await getSupabaseClient()
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
    
    return data;
  }
};

// Contacts table operations
const contacts = {
  async findByUserId(userId: string) {
    const { data, error } = await getSupabaseClient()
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error finding contacts by user ID:', error);
      throw error;
    }
    
    return data || [];
  },

  async create(contactData: any) {
    const { data, error } = await getSupabaseClient()
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

  async update(id: string, updates: any) {
    const { data, error } = await getSupabaseClient()
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating contact:', error);
      throw error;
    }
    
    return data;
  },

  async findById(id: string) {
    const { data, error } = await getSupabaseClient()
      .from('contacts')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error finding contact by ID:', error);
      throw error;
    }
    
    return data;
  },

  async delete(id: string) {
    const { error } = await getSupabaseClient()
      .from('contacts')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error('Error deleting contact:', error);
      throw error;
    }
  },

  async search(userId: string, searchTerm: string) {
    const { data, error } = await getSupabaseClient()
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .or(`name.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`)
      .order('relationship_strength', { ascending: false });
    
    if (error) {
      logger.error('Error searching contacts:', error);
      throw error;
    }
    
    return data || [];
  }
};

// Interactions table operations
const interactions = {
  async create(interactionData: any) {
    const { data, error } = await getSupabaseClient()
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

  async findByContact(contactId: string, limit?: number) {
    let query = getSupabaseClient()
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Error finding interactions by contact:', error);
      throw error;
    }
    
    return data || [];
  },

  async findByUser(userId: string) {
    const { data, error } = await getSupabaseClient()
      .from('interactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error finding interactions by user:', error);
      throw error;
    }
    
    return data || [];
  }
};

// Goals table operations
const goals = {
  async create(goalData: any) {
    const { data, error } = await getSupabaseClient()
      .from('goals')
      .insert(goalData)
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating goal:', error);
      throw error;
    }
    
    return data;
  },

  async findByUserId(userId: string, status?: string) {
    let query = getSupabaseClient()
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Error finding goals by user ID:', error);
      throw error;
    }
    
    return data || [];
  },

  async findActive(userId: string) {
    return this.findByUserId(userId, 'active');
  },

  async findById(id: string) {
    const { data, error } = await getSupabaseClient()
      .from('goals')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error finding goal by ID:', error);
      throw error;
    }
    
    return data;
  },

  async update(id: string, updates: any) {
    const { data, error } = await getSupabaseClient()
      .from('goals')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating goal:', error);
      throw error;
    }
    
    return data;
  },

  async delete(id: string) {
    const { error } = await getSupabaseClient()
      .from('goals')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error('Error deleting goal:', error);
      throw error;
    }
  }
};

// Introductions table operations
const introductions = {
  async create(introductionData: any) {
    const { data, error } = await getSupabaseClient()
      .from('introductions')
      .insert(introductionData)
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating introduction:', error);
      throw error;
    }
    
    return data;
  },

  async findByUserId(userId: string, status?: string) {
    let query = getSupabaseClient()
      .from('introductions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logger.error('Error finding introductions by user ID:', error);
      throw error;
    }
    
    return data || [];
  },

  async findById(id: string) {
    const { data, error } = await getSupabaseClient()
      .from('introductions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error('Error finding introduction by ID:', error);
      throw error;
    }
    
    return data;
  },

  async update(id: string, updates: any) {
    const { data, error } = await getSupabaseClient()
      .from('introductions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error('Error updating introduction:', error);
      throw error;
    }
    
    return data;
  },

  async delete(id: string) {
    const { error } = await getSupabaseClient()
      .from('introductions')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error('Error deleting introduction:', error);
      throw error;
    }
  },

  async findByContacts(fromContactId: string, toContactId: string) {
    const { data, error } = await getSupabaseClient()
      .from('introductions')
      .select('*')
      .or(`and(from_contact_id.eq.${fromContactId},to_contact_id.eq.${toContactId}),and(from_contact_id.eq.${toContactId},to_contact_id.eq.${fromContactId})`)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      logger.error('Error finding introduction by contacts:', error);
      throw error;
    }
    
    return data;
  },

  async findByContact(contactId: string) {
    const { data, error } = await getSupabaseClient()
      .from('introductions')
      .select('*')
      .or(`from_contact_id.eq.${contactId},to_contact_id.eq.${contactId}`)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error finding introductions by contact:', error);
      throw error;
    }
    
    return data || [];
  },

  async findRecentByUserId(userId: string, limit: number) {
    const { data, error } = await getSupabaseClient()
      .from('introductions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.error('Error finding recent introductions:', error);
      throw error;
    }
    
    return data || [];
  }
};

// Voice Messages table operations
const voiceMessages = {
  async create(messageData: any) {
    const { data, error } = await getSupabaseClient()
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
    const { data, error } = await getSupabaseClient()
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
  }
};

// Insights table operations
const insights = {
  async create(insightData: any) {
    const { data, error } = await getSupabaseClient()
      .from('insights')
      .insert(insightData)
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating insight:', error);
      throw error;
    }
    
    return data;
  },

  async findByContact(contactId: string) {
    const { data, error } = await getSupabaseClient()
      .from('insights')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error finding insights by contact:', error);
      throw error;
    }
    
    return data || [];
  },

  async findByGoal(goalId: string) {
    const { data, error } = await getSupabaseClient()
      .from('insights')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false });
    
    if (error) {
      logger.error('Error finding insights by goal:', error);
      throw error;
    }
    
    return data || [];
  }
};

// Database connection test
async function testConnection() {
  try {
    const { data, error } = await getSupabaseClient()
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
    
    logger.info('Database connection test successful');
    return true;
  } catch (error) {
    logger.error('Database connection test failed:', error);
    return false;
  }
}

export default {
  users,
  contacts,
  interactions,
  goals,
  introductions,
  insights,
  voiceMessages,
  testConnection,
  supabase
};
