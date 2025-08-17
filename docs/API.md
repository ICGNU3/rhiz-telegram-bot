# Rhiz API Documentation

## Overview

Rhiz provides both internal service APIs and REST endpoints for managing relationships, contacts, and voice interactions.

## Internal Service APIs

### Contact Service

The Contact Service handles all contact-related operations including creation, updates, and relationship scoring.

#### Methods

##### `addFromTranscript(userId: string, transcript: string): Promise<Contact>`

Adds a new contact or updates an existing one based on voice transcript analysis.

**Parameters:**
- `userId` (string): The user's unique identifier
- `transcript` (string): The transcribed voice message

**Returns:** Promise<Contact>

**Example:**
```typescript
const contact = await contactService.addFromTranscript(
  'user123',
  "I just met Sarah Chen, she's the CTO at TechStart and we discussed potential partnership opportunities"
);

console.log(contact);
// {
//   id: 'uuid',
//   name: 'Sarah Chen',
//   company: 'TechStart',
//   title: 'CTO',
//   relationship_score: 75,
//   trust_level: 'professional'
// }
```

##### `searchFromTranscript(userId: string, transcript: string): Promise<Contact[]>`

Searches for contacts based on voice transcript analysis.

**Parameters:**
- `userId` (string): The user's unique identifier
- `transcript` (string): The transcribed voice message

**Returns:** Promise<Contact[]>

**Example:**
```typescript
const contacts = await contactService.searchFromTranscript(
  'user123',
  "Tell me about David from the conference"
);

console.log(contacts);
// [
//   {
//     id: 'uuid',
//     name: 'David Smith',
//     company: 'TechCorp',
//     title: 'VP Engineering',
//     relationship_score: 85
//   }
// ]
```

##### `updateRelationshipScore(contactId: string): Promise<void>`

Updates the relationship score for a specific contact based on interactions and AI analysis.

**Parameters:**
- `contactId` (string): The contact's unique identifier

**Returns:** Promise<void>

##### `findSimilar(contactId: string, limit?: number): Promise<Contact[]>`

Finds contacts similar to the specified contact using AI embeddings.

**Parameters:**
- `contactId` (string): The contact's unique identifier
- `limit` (number, optional): Maximum number of results (default: 5)

**Returns:** Promise<Contact[]>

##### `addInteraction(contactId: string, interactionData: any): Promise<Interaction>`

Adds a new interaction with a contact and updates relationship metrics.

**Parameters:**
- `contactId` (string): The contact's unique identifier
- `interactionData` (object): Interaction details

**Returns:** Promise<Interaction>

**Example:**
```typescript
const interaction = await contactService.addInteraction('contact123', {
  type: 'meeting',
  content: 'Had coffee to discuss potential collaboration',
  date: new Date(),
  duration: 60
});
```

##### `getContactSummary(contactId: string): Promise<ContactSummary>`

Gets a comprehensive summary of a contact including recent interactions.

**Parameters:**
- `contactId` (string): The contact's unique identifier

**Returns:** Promise<ContactSummary>

##### `updateContact(contactId: string, updates: any): Promise<Contact>`

Updates contact information and recalculates relationship score if relevant fields change.

**Parameters:**
- `contactId` (string): The contact's unique identifier
- `updates` (object): Fields to update

**Returns:** Promise<Contact>

##### `deleteContact(contactId: string): Promise<void>`

Deletes a contact and all associated interactions.

**Parameters:**
- `contactId` (string): The contact's unique identifier

**Returns:** Promise<void>

### Relationship Service

The Relationship Service manages goals, relationship insights, and strategic networking.

#### Methods

##### `createGoalFromTranscript(userId: string, transcript: string): Promise<Goal>`

Creates a new goal based on voice transcript analysis.

**Parameters:**
- `userId` (string): The user's unique identifier
- `transcript` (string): The transcribed voice message

**Returns:** Promise<Goal>

**Example:**
```typescript
const goal = await relationshipService.createGoalFromTranscript(
  'user123',
  "My goal is to raise a seed round by Q2"
);

console.log(goal);
// {
//   id: 'uuid',
//   description: 'Raise seed round',
//   type: 'fundraising',
//   target_date: '2024-06-30',
//   status: 'active'
// }
```

##### `calculateScore(contact: Contact, interactions: Interaction[]): Promise<number>`

Calculates a relationship score based on contact data and interaction history.

**Parameters:**
- `contact` (Contact): Contact object
- `interactions` (Interaction[]): Array of interactions

**Returns:** Promise<number>

##### `getInsights(contactId: string): Promise<RelationshipInsight>`

Gets AI-generated insights about a relationship.

**Parameters:**
- `contactId` (string): The contact's unique identifier

**Returns:** Promise<RelationshipInsight>

### Introduction Service

The Introduction Service suggests and manages valuable introductions between contacts.

#### Methods

##### `suggestFromGoals(userId: string): Promise<Introduction[]>`

Suggests introductions based on user goals and contact network.

**Parameters:**
- `userId` (string): The user's unique identifier

**Returns:** Promise<Introduction[]>

**Example:**
```typescript
const introductions = await introductionService.suggestFromGoals('user123');

console.log(introductions);
// [
//   {
//     id: 'uuid',
//     from_contact: { name: 'Sarah Chen', company: 'TechStart' },
//     to_contact: { name: 'David Smith', company: 'TechCorp' },
//     reason: 'Both are interested in AI partnerships',
//     suggested_message: 'Hi Sarah, I think you should meet David...'
//   }
// ]
```

##### `generateMessage(fromId: string, toId: string): Promise<string>`

Generates a personalized introduction message.

**Parameters:**
- `fromId` (string): The introducing contact's ID
- `toId` (string): The contact being introduced

**Returns:** Promise<string>

##### `markSent(introId: string): Promise<void>`

Marks an introduction as sent and tracks the interaction.

**Parameters:**
- `introId` (string): The introduction's unique identifier

**Returns:** Promise<void>

## REST API Endpoints

### Webhook Endpoint

#### `POST /webhook/bot:token`

Receives updates from Telegram Bot API.

**Headers:**
- `Content-Type: application/json`

**Body:** Telegram Update object

**Response:** 200 OK

**Example:**
```bash
curl -X POST https://your-app.railway.app/webhook/bot:token \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 123456789,
    "message": {
      "message_id": 1,
      "from": {"id": 123456789, "first_name": "John"},
      "chat": {"id": 123456789, "type": "private"},
      "date": 1234567890,
      "voice": {
        "file_id": "AwADBAADbXXXXXXXXXXXGBdhD2l6_XX",
        "duration": 5,
        "mime_type": "audio/ogg"
      }
    }
  }'
```

### Health Check

#### `GET /health`

Returns the health status of the application.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Manual Sync

#### `POST /api/sync/:userId`

Triggers manual synchronization with Google Sheets.

**Parameters:**
- `userId` (string): The user's unique identifier

**Response:**
```json
{
  "synced": true,
  "contacts": 25,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### User Management

#### `GET /api/users/:userId`

Gets user information and settings.

**Parameters:**
- `userId` (string): The user's unique identifier

**Response:**
```json
{
  "id": "uuid",
  "telegram_id": 123456789,
  "telegram_username": "john_doe",
  "settings": {
    "voice_enabled": true,
    "notifications": true
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### `PUT /api/users/:userId`

Updates user settings.

**Parameters:**
- `userId` (string): The user's unique identifier

**Body:**
```json
{
  "settings": {
    "voice_enabled": false,
    "notifications": true
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "settings": {
    "voice_enabled": false,
    "notifications": true
  },
  "updated_at": "2024-01-15T10:30:00Z"
}
```

## Data Types

### Contact

```typescript
interface Contact {
  id: string;
  user_id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  telegram_username?: string;
  met_at?: string;
  met_date?: string;
  relationship_type?: string;
  context?: string;
  interests?: string[];
  strengths?: string[];
  projects?: string[];
  goals?: string[];
  ai_summary?: string;
  ai_insights?: any;
  relationship_strength?: number;
  compatibility_score?: number;
  last_interaction_date?: string;
  interaction_frequency?: string;
  last_interaction_type?: string;
  next_action?: string;
  source?: string;
  tags?: string[];
  is_favorite?: boolean;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}
```

### Interaction

```typescript
interface Interaction {
  id: string;
  user_id: string;
  contact_id: string;
  interaction_type: string;
  content?: string;
  date: string;
  duration?: number;
  location?: string;
  outcome?: string;
  follow_up_required?: boolean;
  follow_up_date?: string;
  created_at: string;
}
```

### Goal

```typescript
interface Goal {
  id: string;
  user_id: string;
  description: string;
  type: 'fundraising' | 'hiring' | 'partnership' | 'sales' | 'networking' | 'other';
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  progress: number;
  target_date?: string;
  priority: 'low' | 'medium' | 'high';
  related_contacts?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### Introduction

```typescript
interface Introduction {
  id: string;
  user_id: string;
  from_contact_id: string;
  to_contact_id: string;
  reason: string;
  suggested_message: string;
  status: 'suggested' | 'sent' | 'accepted' | 'declined';
  sent_at?: string;
  response?: string;
  created_at: string;
}
```

## Error Handling

All API endpoints return appropriate HTTP status codes and error messages.

### Error Response Format

```json
{
  "error": {
    "code": "CONTACT_NOT_FOUND",
    "message": "Contact with ID 'uuid' not found",
    "details": {
      "contact_id": "uuid"
    }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_INPUT` | Invalid request parameters | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `FORBIDDEN` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMITED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |
| `SERVICE_UNAVAILABLE` | External service unavailable | 503 |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Webhook endpoint**: 100 requests per minute per bot
- **REST endpoints**: 1000 requests per hour per user
- **Voice processing**: 10 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642233600
```

## Authentication

REST API endpoints require authentication using API keys or session tokens.

### API Key Authentication

Include the API key in the Authorization header:

```
Authorization: Bearer your-api-key-here
```

### Session Authentication

Include the session token in the Authorization header:

```
Authorization: Session your-session-token-here
```

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install rhiz-sdk
```

```typescript
import { RhizClient } from 'rhiz-sdk';

const client = new RhizClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.rhiz.ai'
});

// Add contact
const contact = await client.contacts.addFromTranscript(
  'user123',
  'I met John Doe at TechCorp'
);

// Search contacts
const contacts = await client.contacts.search('user123', 'John');
```

### Python

```bash
pip install rhiz-python
```

```python
from rhiz import RhizClient

client = RhizClient(api_key='your-api-key')

# Add contact
contact = client.contacts.add_from_transcript(
    user_id='user123',
    transcript='I met John Doe at TechCorp'
)

# Search contacts
contacts = client.contacts.search('user123', 'John')
```

## Webhooks

Rhiz can send webhooks to your application for real-time updates.

### Webhook Events

| Event | Description | Payload |
|-------|-------------|---------|
| `contact.created` | New contact added | Contact object |
| `contact.updated` | Contact updated | Contact object |
| `interaction.created` | New interaction logged | Interaction object |
| `goal.created` | New goal created | Goal object |
| `introduction.suggested` | New introduction suggested | Introduction object |

### Webhook Configuration

```typescript
// Register webhook endpoint
await client.webhooks.create({
  url: 'https://your-app.com/webhooks/rhiz',
  events: ['contact.created', 'interaction.created'],
  secret: 'your-webhook-secret'
});
```

### Webhook Verification

Verify webhook signatures to ensure authenticity:

```typescript
import crypto from 'crypto';

function verifyWebhook(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```
