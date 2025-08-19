-- Rhiz MVP - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    -- Goals and preferences
    goals JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Integration settings
    google_sheets_url TEXT,
    google_sheets_id TEXT,
    google_access_token TEXT,
    google_refresh_token TEXT,
    
    -- Onboarding and status
    onboarding_completed BOOLEAN DEFAULT FALSE,
    onboarding_step INTEGER DEFAULT 0,
    
    -- Subscription info
    subscription_tier VARCHAR(50) DEFAULT 'root_alpha',
    subscription_expires_at TIMESTAMP,
    referral_code VARCHAR(20) UNIQUE,
    referred_by UUID REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts table
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic contact info
    name VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    company VARCHAR(255),
    title VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(255),
    linkedin_url TEXT,
    telegram_username VARCHAR(255),
    
    -- Relationship context
    met_at TEXT,
    met_date DATE,
    relationship_type VARCHAR(50),
    context TEXT,
    
    -- Interests and attributes
    interests TEXT[] DEFAULT '{}',
    strengths TEXT[] DEFAULT '{}',
    projects TEXT[] DEFAULT '{}',
    goals TEXT[] DEFAULT '{}',
    
    -- AI-generated insights
    ai_summary TEXT,
    ai_insights JSONB DEFAULT '{}'::jsonb,
    relationship_strength INTEGER CHECK (relationship_strength >= 1 AND relationship_strength <= 10),
    compatibility_score DECIMAL(3,2),
    
    -- Interaction tracking
    last_interaction_date DATE,
    interaction_frequency VARCHAR(20),
    last_interaction_type VARCHAR(50),
    next_action TEXT,
    
    -- Source and metadata
    source VARCHAR(50) DEFAULT 'voice_input',
    tags TEXT[] DEFAULT '{}',
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interactions table
CREATE TABLE interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL,
    content TEXT,
    ai_summary TEXT,
    
    -- Scheduling
    scheduled_for TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    location TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'planned',
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Introductions table
CREATE TABLE introductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_a_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    contact_b_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Introduction details
    suggestion_reason TEXT NOT NULL,
    ai_confidence_score DECIMAL(3,2) NOT NULL,
    mutual_benefit TEXT,
    context TEXT,
    
    -- Generated content
    ai_draft_message TEXT,
    custom_message TEXT,
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'suggested',
    sent_at TIMESTAMP WITH TIME ZONE,
    response_received BOOLEAN DEFAULT FALSE,
    
    -- Feedback
    user_feedback VARCHAR(20),
    outcome_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voice messages table
CREATE TABLE voice_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message details
    telegram_message_id INTEGER,
    transcript TEXT,
    intent VARCHAR(50),
    confidence_score DECIMAL(3,2),
    
    -- Processing results
    action_taken VARCHAR(100),
    extracted_data JSONB DEFAULT '{}'::jsonb,
    ai_response TEXT,
    
    -- Audio metadata
    duration_seconds INTEGER,
    file_size_bytes INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table for phone-like experience
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session details
    session_id VARCHAR(100) UNIQUE NOT NULL,
    topic VARCHAR(100),
    mood VARCHAR(20) CHECK (mood IN ('casual', 'professional', 'urgent')),
    
    -- Conversation data
    summary TEXT,
    duration_ms INTEGER,
    message_count INTEGER DEFAULT 0,
    
    -- Context
    active_contacts JSONB DEFAULT '[]'::jsonb,
    current_goal TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_relationship_strength ON contacts(relationship_strength);
CREATE INDEX idx_interactions_user_id ON interactions(user_id);
CREATE INDEX idx_interactions_contact_id ON interactions(contact_id);
CREATE INDEX idx_introductions_user_id ON introductions(user_id);
CREATE INDEX idx_voice_messages_user_id ON voice_messages(user_id);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own data" ON users 
    FOR ALL USING (telegram_id = (current_setting('app.current_user_telegram_id'))::bigint);

CREATE POLICY "Users can view own contacts" ON contacts 
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE telegram_id = (current_setting('app.current_user_telegram_id'))::bigint
    ));

CREATE POLICY "Users can view own interactions" ON interactions 
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE telegram_id = (current_setting('app.current_user_telegram_id'))::bigint
    ));

CREATE POLICY "Users can view own introductions" ON introductions 
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE telegram_id = (current_setting('app.current_user_telegram_id'))::bigint
    ));

CREATE POLICY "Users can view own voice messages" ON voice_messages 
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE telegram_id = (current_setting('app.current_user_telegram_id'))::bigint
    ));

CREATE POLICY "Users can view own conversations" ON conversations 
    FOR ALL USING (user_id IN (
        SELECT id FROM users WHERE telegram_id = (current_setting('app.current_user_telegram_id'))::bigint
    ));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON interactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_introductions_updated_at BEFORE UPDATE ON introductions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
