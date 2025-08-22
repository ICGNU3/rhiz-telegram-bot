import { google } from 'googleapis';
import config from '../utils/config';
import logger from '../utils/logger';

interface ContactRow {
  name: string;
  company: string;
  title: string;
  email: string;
  phone: string;
  relationship_score: number;
  last_interaction: string;
  notes: string;
  linkedin_url?: string;
  twitter_url?: string;
  website?: string;
  location?: string;
  industry?: string;
  company_size?: string;
  funding_stage?: string;
  ai_insights?: string;
  enriched_data?: string;
}

interface EnrichmentData {
  company_info?: {
    description: string;
    industry: string;
    size: string;
    founded: string;
    website: string;
    linkedin: string;
  };
  person_info?: {
    linkedin_profile: string;
    twitter_profile: string;
    bio: string;
    skills: string[];
    experience: string[];
  };
  relationship_insights?: {
    mutual_connections: string[];
    common_interests: string[];
    potential_collaborations: string[];
  };
}

interface UserGoogleConfig {
  access_token?: string;
  refresh_token?: string;
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  connected_at?: string;
}

export class GoogleSheetsService {
  private auth: any;
  private sheets: any;

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    try {
      this.auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: config.google.clientEmail,
          private_key: config.google.privateKey,
        },
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.readonly'
        ],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      logger.info('Google Sheets service initialized successfully');
    } catch (error) {
      logger.error('Error initializing Google Sheets auth:', error);
      throw error;
    }
  }

  /**
   * Get Google OAuth URL for user to connect their account
   */
  getOAuthUrl(userId: string): string {
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      `${config.telegram.webhookUrl}/auth/google/callback`
    );

    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId, // Pass user ID in state
      prompt: 'consent'
    });
  }

  /**
   * Handle OAuth callback and get user tokens
   */
  async handleOAuthCallback(code: string, _state: string): Promise<UserGoogleConfig> {
    try {
      const oauth2Client = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        `${config.telegram.webhookUrl}/auth/google/callback`
      );

      const { tokens } = await oauth2Client.getToken(code);
      
      return {
        access_token: tokens.access_token || undefined,
        refresh_token: tokens.refresh_token || undefined,
        connected_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error handling OAuth callback:', error);
      throw error;
    }
  }

  /**
   * Get authenticated sheets client for a specific user
   */
  private async getUserSheetsClient(userConfig: UserGoogleConfig) {
    if (!userConfig.access_token) {
      throw new Error('User not connected to Google Sheets');
    }

    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      `${config.telegram.webhookUrl}/auth/google/callback`
    );

    oauth2Client.setCredentials({
      access_token: userConfig.access_token,
      refresh_token: userConfig.refresh_token
    });

    return google.sheets({ version: 'v4', auth: oauth2Client });
  }

  /**
   * Sync contacts from database to user's Google Sheets
   */
  async syncContactsToSheet(contacts: any[], userId: string, userConfig: UserGoogleConfig): Promise<void> {
    try {
      if (!userConfig.spreadsheet_id) {
        throw new Error('No spreadsheet configured for user');
      }

      const userSheets = await this.getUserSheetsClient(userConfig);

      // Prepare headers
      const headers = [
        'Name', 'Company', 'Title', 'Email', 'Phone', 
        'Relationship Score', 'Last Interaction', 'Notes',
        'LinkedIn URL', 'Twitter URL', 'Website', 'Location',
        'Industry', 'Company Size', 'Funding Stage', 'AI Insights',
        'Enriched Data', 'User ID', 'Created At'
      ];

      // Convert contacts to rows
      const rows = contacts.map(contact => [
        contact.name || '',
        contact.company || '',
        contact.title || '',
        contact.email || '',
        contact.phone || '',
        contact.relationship_strength || 0,
        contact.last_interaction_date || '',
        contact.notes || '',
        contact.linkedin_url || '',
        '', // Twitter URL (to be enriched)
        '', // Website (to be enriched)
        contact.location || '',
        '', // Industry (to be enriched)
        '', // Company Size (to be enriched)
        '', // Funding Stage (to be enriched)
        contact.ai_insights ? JSON.stringify(contact.ai_insights) : '',
        '', // Enriched Data (to be populated)
        userId,
        contact.created_at || new Date().toISOString()
      ]);

      // Clear existing data and write new data
      await userSheets.spreadsheets.values.clear({
        spreadsheetId: userConfig.spreadsheet_id,
        range: 'A1:Z1000',
      });

      // Write headers and data
      await userSheets.spreadsheets.values.update({
        spreadsheetId: userConfig.spreadsheet_id,
        range: 'A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers, ...rows]
        },
      });

      logger.info(`Synced ${contacts.length} contacts to user's Google Sheets`);
    } catch (error) {
      logger.error('Error syncing contacts to Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Enrich contact data using external APIs and AI
   */
  async enrichContact(contact: any): Promise<EnrichmentData> {
    try {
      const enrichment: EnrichmentData = {};

      // Enrich company information if available
      if (contact.company) {
        enrichment.company_info = await this.enrichCompanyInfo(contact.company);
      }

      // Enrich person information if available
      if (contact.name || contact.email) {
        enrichment.person_info = await this.enrichPersonInfo(contact);
      }

      // Generate relationship insights using AI
      enrichment.relationship_insights = await this.generateRelationshipInsights(contact);

      return enrichment;
    } catch (error) {
      logger.error('Error enriching contact:', error);
      return {};
    }
  }

  /**
   * Enrich company information using external APIs
   */
  private async enrichCompanyInfo(companyName: string): Promise<any> {
    try {
      // This would integrate with APIs like:
      // - Clearbit API for company data
      // - Crunchbase API for funding info
      // - LinkedIn API for company insights
      
      // For now, return mock data structure
      return {
        description: `AI-powered insights for ${companyName}`,
        industry: 'Technology',
        size: '50-200 employees',
        founded: '2020',
        website: `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
        linkedin: `https://linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '')}`
      };
    } catch (error) {
      logger.error('Error enriching company info:', error);
      return {};
    }
  }

  /**
   * Enrich person information
   */
  private async enrichPersonInfo(contact: any): Promise<any> {
    try {
      // This would integrate with:
      // - LinkedIn API for professional info
      // - Twitter API for social presence
      // - Email verification APIs
      
      return {
        linkedin_profile: `https://linkedin.com/in/${contact.name?.toLowerCase().replace(/\s+/g, '')}`,
        twitter_profile: `https://twitter.com/${contact.name?.toLowerCase().replace(/\s+/g, '')}`,
        bio: `Professional profile for ${contact.name}`,
        skills: ['Leadership', 'Strategy', 'Technology'],
        experience: [`${contact.title} at ${contact.company}`]
      };
    } catch (error) {
      logger.error('Error enriching person info:', error);
      return {};
    }
  }

  /**
   * Generate AI-powered relationship insights
   */
  private async generateRelationshipInsights(contact: any): Promise<any> {
    try {
      // This would use GPT-4 to analyze the contact and generate insights
      const insights = {
        mutual_connections: ['John Doe', 'Jane Smith'],
        common_interests: ['AI/ML', 'Startups', 'Innovation'],
        potential_collaborations: [
          'Product development partnership',
          'Investment opportunity',
          'Strategic advisory role'
        ]
      };

      return insights;
    } catch (error) {
      logger.error('Error generating relationship insights:', error);
      return {};
    }
  }

  /**
   * Read contacts from user's Google Sheets
   */
  async readContactsFromSheet(userConfig: UserGoogleConfig): Promise<ContactRow[]> {
    try {
      if (!userConfig.spreadsheet_id) {
        logger.warn('No spreadsheet ID configured for user');
        return [];
      }

      const userSheets = await this.getUserSheetsClient(userConfig);

      const response = await userSheets.spreadsheets.values.get({
        spreadsheetId: userConfig.spreadsheet_id,
        range: 'A2:Z1000', // Skip header row
      });

      const rows = response.data.values || [];
      
      return rows.map((row: any[]) => ({
        name: row[0] || '',
        company: row[1] || '',
        title: row[2] || '',
        email: row[3] || '',
        phone: row[4] || '',
        relationship_score: parseInt(row[5]) || 0,
        last_interaction: row[6] || '',
        notes: row[7] || '',
        linkedin_url: row[8] || '',
        twitter_url: row[9] || '',
        website: row[10] || '',
        location: row[11] || '',
        industry: row[12] || '',
        company_size: row[13] || '',
        funding_stage: row[14] || '',
        ai_insights: row[15] || '',
        enriched_data: row[16] || '',
      }));
    } catch (error) {
      logger.error('Error reading contacts from Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Update a specific contact in user's Google Sheets
   */
  async updateContactInSheet(contactId: string, updates: any, userConfig: UserGoogleConfig): Promise<void> {
    try {
      if (!userConfig.spreadsheet_id) {
        logger.warn('No spreadsheet ID configured for user');
        return;
      }

      const userSheets = await this.getUserSheetsClient(userConfig);

      // Find the row with the contact
      const contacts = await this.readContactsFromSheet(userConfig);
      const contactIndex = contacts.findIndex(c => c.name === updates.name);
      
      if (contactIndex === -1) {
        logger.warn(`Contact ${updates.name} not found in sheet`);
        return;
      }

      // Update the specific row
      const rowNumber = contactIndex + 2; // +2 because we skip header and arrays are 0-indexed
      
      await userSheets.spreadsheets.values.update({
        spreadsheetId: userConfig.spreadsheet_id,
        range: `A${rowNumber}:Z${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            updates.name || '',
            updates.company || '',
            updates.title || '',
            updates.email || '',
            updates.phone || '',
            updates.relationship_score || 0,
            updates.last_interaction || '',
            updates.notes || '',
            updates.linkedin_url || '',
            updates.twitter_url || '',
            updates.website || '',
            updates.location || '',
            updates.industry || '',
            updates.company_size || '',
            updates.funding_stage || '',
            updates.ai_insights || '',
            updates.enriched_data || '',
          ]]
        },
      });

      logger.info(`Updated contact ${updates.name} in user's Google Sheets`);
    } catch (error) {
      logger.error('Error updating contact in Google Sheets:', error);
      throw error;
    }
  }

  /**
   * Create a new Google Sheet for user's contacts
   */
  async createContactsSheet(userConfig: UserGoogleConfig, title: string = 'Rhiz Contacts'): Promise<string> {
    try {
      const userSheets = await this.getUserSheetsClient(userConfig);

      const response = await userSheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: title,
          },
          sheets: [
            {
              properties: {
                title: 'Contacts',
                gridProperties: {
                  rowCount: 1000,
                  columnCount: 20,
                },
              },
            },
          ],
        },
      });

      const spreadsheetId = response.data.spreadsheetId;
      if (!spreadsheetId) {
        throw new Error('Failed to create spreadsheet - no ID returned');
      }
      
      logger.info(`Created new Google Sheet for user: ${spreadsheetId}`);
      
      return spreadsheetId;
    } catch (error) {
      logger.error('Error creating Google Sheet:', error);
      throw error;
    }
  }

  /**
   * Get user's spreadsheet info
   */
  async getSpreadsheetInfo(userConfig: UserGoogleConfig): Promise<any> {
    try {
      if (!userConfig.spreadsheet_id) {
        return { error: 'No spreadsheet ID configured for user' };
      }

      const userSheets = await this.getUserSheetsClient(userConfig);

      const response = await userSheets.spreadsheets.get({
        spreadsheetId: userConfig.spreadsheet_id,
      });

      return {
        title: response.data.properties?.title || 'Untitled',
        url: `https://docs.google.com/spreadsheets/d/${userConfig.spreadsheet_id}/edit`,
        sheets: response.data.sheets?.map((sheet: any) => sheet.properties.title) || [],
      };
    } catch (error) {
      logger.error('Error getting spreadsheet info:', error);
      throw error;
    }
  }
}

export default new GoogleSheetsService();
