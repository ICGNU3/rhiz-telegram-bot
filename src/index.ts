import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './utils/config';
import logger from './utils/logger';
import { RhizTelegramBot } from './bot/telegramBot';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Webhook endpoint for Telegram
app.post(`/webhook/${config.telegram.botToken}`, async (req, res) => {
  try {
    // Handle Telegram webhook
    logger.info('Received Telegram webhook');
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual sync endpoint
app.post('/api/sync/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    logger.info(`Manual sync requested for user: ${userId}`);
    res.json({
      synced: true,
      contacts: 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in manual sync:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
  logger.info(`🚀 Rhiz Bot server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔗 Webhook: http://localhost:${PORT}/webhook/${config.telegram.botToken}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
