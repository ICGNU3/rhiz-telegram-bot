import dotenv from 'dotenv';
dotenv.config();

interface Config {
  env: string;
  port: number;
  telegram: {
    botToken: string;
    webhookUrl: string;
  };
  openai: {
    apiKey: string;
    model: string;
    whisperModel: string;
  };
  elevenlabs: {
    apiKey: string;
    voiceId: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  google: {
    clientEmail: string;
    privateKey: string;
  };
  sentry?: {
    dsn: string;
  };
  posthog?: {
    apiKey: string;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL!,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4-turbo-preview',
    whisperModel: 'whisper-1',
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM',
  },
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  },
  google: {
    clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL!,
    privateKey: process.env.GOOGLE_SHEETS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
  sentry: process.env.SENTRY_DSN ? {
    dsn: process.env.SENTRY_DSN,
  } : undefined,
  posthog: process.env.POSTHOG_API_KEY ? {
    apiKey: process.env.POSTHOG_API_KEY,
  } : undefined,
};

// Validate required config
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_URL',
  'OPENAI_API_KEY',
  'ELEVENLABS_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export default config;
