import { parse } from 'csv-parse/sync';
import logger from '../utils/logger';
import db from '../db/supabase';

interface ImportedContact {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  notes?: string;
  source?: string;
}

export class ContactImporter {
  
  async importFromCSV(userId: string, csvContent: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      // Parse CSV
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      for (const record of records) {
        try {
          const contact = this.mapCSVToContact(record);
          await this.saveContact(userId, contact);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Failed to import ${record.name || 'unknown'}: ${error.message}`);
        }
      }
    } catch (error: any) {
      logger.error('CSV import error:', error);
      results.errors.push(`CSV parsing failed: ${error.message}`);
    }

    return results;
  }

  private mapCSVToContact(record: any): ImportedContact {
    // Support multiple CSV formats
    return {
      name: record.name || record.Name || `${record.first_name || ''} ${record.last_name || ''}`.trim(),
      email: record.email || record.Email || record.email_address,
      phone: record.phone || record.Phone || record.mobile || record.telephone,
      company: record.company || record.Company || record.organization,
      title: record.title || record.Title || record.job_title || record.position,
      notes: record.notes || record.Notes || record.description,
      source: 'csv_import'
    };
  }

  async importFromGoogleContacts(userId: string, accessToken: string): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      // Fetch contacts from Google People API
      const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,biographies', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Google contacts');
      }

      const data = await response.json();
      const connections = data.connections || [];

      for (const person of connections) {
        try {
          const contact = this.mapGoogleContactToContact(person);
          await this.saveContact(userId, contact);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Failed to import Google contact: ${error.message}`);
        }
      }
    } catch (error: any) {
      logger.error('Google Contacts import error:', error);
      results.errors.push(`Google import failed: ${error.message}`);
    }

    return results;
  }

  private mapGoogleContactToContact(person: any): ImportedContact {
    const name = person.names?.[0];
    const email = person.emailAddresses?.[0];
    const phone = person.phoneNumbers?.[0];
    const org = person.organizations?.[0];
    const bio = person.biographies?.[0];

    return {
      name: name?.displayName || 'Unknown',
      email: email?.value,
      phone: phone?.value,
      company: org?.name,
      title: org?.title,
      notes: bio?.value,
      source: 'google_contacts'
    };
  }

  async importFromLinkedIn(userId: string, linkedInData: any[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const connection of linkedInData) {
      try {
        const contact: ImportedContact = {
          name: connection.name,
          company: connection.company,
          title: connection.title,
          email: connection.email,
          notes: `LinkedIn: ${connection.headline || ''}`,
          source: 'linkedin'
        };
        
        await this.saveContact(userId, contact);
        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Failed to import ${connection.name}: ${error.message}`);
      }
    }

    return results;
  }

  async importBulkText(userId: string, text: string): Promise<{
    contacts: ImportedContact[];
    message: string;
  }> {
    const contacts: ImportedContact[] = [];
    
    // Parse different text formats
    const lines = text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Pattern 1: "Name - Company - Title"
      const dashPattern = /^(.+?)\s*-\s*(.+?)\s*-\s*(.+?)$/;
      // Pattern 2: "Name at Company"
      const atPattern = /^(.+?)\s+at\s+(.+?)$/i;
      // Pattern 3: "Name, Title, Company"
      const commaPattern = /^(.+?),\s*(.+?),\s*(.+?)$/;
      
      let contact: ImportedContact | null = null;
      
      if (dashPattern.test(line)) {
        const [, name, company, title] = line.match(dashPattern)!;
        contact = { name: name.trim(), company: company.trim(), title: title.trim() };
      } else if (atPattern.test(line)) {
        const [, name, company] = line.match(atPattern)!;
        contact = { name: name.trim(), company: company.trim() };
      } else if (commaPattern.test(line)) {
        const [, name, title, company] = line.match(commaPattern)!;
        contact = { name: name.trim(), title: title.trim(), company: company.trim() };
      } else if (line.trim()) {
        // Assume it's just a name
        contact = { name: line.trim() };
      }
      
      if (contact) {
        contacts.push(contact);
        await this.saveContact(userId, contact);
      }
    }
    
    return {
      contacts,
      message: `Imported ${contacts.length} contacts from text`
    };
  }

  private async saveContact(userId: string, contact: ImportedContact): Promise<void> {
    // Check if contact already exists
    const existing = await db.contacts.findByUserId(userId);
    const duplicate = existing?.find((c: any) => 
      c.name.toLowerCase() === contact.name.toLowerCase() &&
      c.company?.toLowerCase() === contact.company?.toLowerCase()
    );

    if (duplicate) {
      // Update existing contact
      await db.contacts.update(duplicate.id, {
        email: contact.email || duplicate.email,
        phone: contact.phone || duplicate.phone,
        title: contact.title || duplicate.title,
        notes: contact.notes || duplicate.notes,
        updated_at: new Date()
      });
    } else {
      // Create new contact
      await db.contacts.create({
        user_id: userId,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        title: contact.title,
        notes: contact.notes,
        source: contact.source || 'import',
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  async importFromTelegramContact(userId: string, contact: any): Promise<{
    success: boolean;
    contact?: ImportedContact;
    error?: string;
  }> {
    try {
      const importedContact: ImportedContact = {
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown',
        phone: contact.phone_number,
        source: 'telegram',
        notes: contact.vcard ? 'Imported from Telegram with vCard' : 'Imported from Telegram'
      };

      // Parse vCard if available
      if (contact.vcard) {
        const vcardData = this.parseVCard(contact.vcard);
        importedContact.email = vcardData.email || importedContact.email;
        importedContact.company = vcardData.org || importedContact.company;
        importedContact.title = vcardData.title || importedContact.title;
      }

      await this.saveContact(userId, importedContact);

      return {
        success: true,
        contact: importedContact
      };
    } catch (error: any) {
      logger.error('Telegram contact import error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private parseVCard(vcard: string): {
    email?: string;
    org?: string;
    title?: string;
  } {
    const result: any = {};
    
    // Extract email
    const emailMatch = vcard.match(/EMAIL[^:]*:([^\r\n]+)/i);
    if (emailMatch) result.email = emailMatch[1].trim();
    
    // Extract organization
    const orgMatch = vcard.match(/ORG:([^\r\n]+)/i);
    if (orgMatch) result.org = orgMatch[1].trim();
    
    // Extract title
    const titleMatch = vcard.match(/TITLE:([^\r\n]+)/i);
    if (titleMatch) result.title = titleMatch[1].trim();
    
    return result;
  }

  // Generate import instructions for user
  getImportInstructions(): string {
    return `📥 **How to Import Contacts**

**Method 1: Telegram Contacts** 📱
1. Type /sync_telegram 
2. Click "Share Contact" button
3. Select contacts from your phone
4. Share them with the bot

**Method 2: CSV File**
1. Send me a CSV file with columns: name, email, phone, company, title
2. I'll automatically parse and import them

**Method 3: Google Contacts**
1. Send /connect_google
2. Authorize access
3. I'll sync your Google contacts

**Method 4: Bulk Text**
Send contacts in any of these formats:
• John Smith - Google - Product Manager
• Sarah Chen at Microsoft
• David Lee, CTO, StartupX
• Or just names on separate lines

**Method 5: LinkedIn Export**
1. Export connections from LinkedIn (CSV)
2. Send me the file
3. I'll import with LinkedIn data

**Method 6: Voice Note**
Just describe multiple contacts in one voice message!

Try sending: "Import contacts" followed by your list!`;
  }
}

export default new ContactImporter();