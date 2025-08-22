import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger';
import whisperService from './whisper';
import elevenLabsService from './elevenlabs';
import gpt4Service from '../ai/gpt4';
import conversationManager from './conversationManager';

// Set ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export class VoiceProcessor {
  private tempDir: string;
  private readonly MAX_VOICE_SIZE = 50 * 1024 * 1024; // 50MB limit
  private readonly MAX_DURATION_SECONDS = 300; // 5 minutes limit

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async convertOggToWav(oggBuffer: Buffer): Promise<string> {
    const inputPath = path.join(this.tempDir, `${Date.now()}-input.ogg`);
    const outputPath = path.join(this.tempDir, `${Date.now()}-output.wav`);

    // Write buffer to file
    fs.writeFileSync(inputPath, oggBuffer);

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioCodec('pcm_s16le')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', () => {
          // Clean up input file
          try {
            fs.unlinkSync(inputPath);
          } catch (err) {
            logger.warn(`Failed to delete input file: ${inputPath}`);
          }
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('FFmpeg conversion error:', err);
          // Clean up on error
          try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          } catch (cleanupErr) {
            logger.warn('Failed to clean up files on error');
          }
          reject(err);
        })
        .save(outputPath);
    });
  }

  async processVoiceMessage(
    audioBuffer: Buffer,
    userId: string,
    context?: any,
    sessionId?: string
  ): Promise<{
    transcript: string;
    intent: string;
    response: string;
    audioResponse: Buffer;
    sessionId: string;
    shouldContinue: boolean;
    suggestedActions: string[];
  }> {
    try {
      // Validate file size
      if (audioBuffer.length > this.MAX_VOICE_SIZE) {
        throw new Error(`Voice message too large. Maximum size is ${Math.round(this.MAX_VOICE_SIZE / 1024 / 1024)}MB`);
      }

      // Validate buffer is not empty
      if (audioBuffer.length === 0) {
        throw new Error('Voice message is empty');
      }

      // Convert OGG to WAV for Whisper
      const wavPath = await this.convertOggToWav(audioBuffer);
      
      // Transcribe audio
      const transcript = await whisperService.transcribe(wavPath);
      logger.info(`Transcript: ${transcript}`);
      
      // Use conversation manager for phone-like experience
      const conversationResult = await conversationManager.processVoiceInput(
        userId,
        transcript,
        sessionId
      );
      
      // Detect intent for backward compatibility
      const intentResult = await gpt4Service.detectIntent(transcript);
      logger.info(`Detected intent: ${intentResult.intent}`);
      
      return {
        transcript,
        intent: intentResult.intent,
        response: conversationResult.response,
        audioResponse: conversationResult.audioResponse,
        sessionId: conversationResult.sessionId,
        shouldContinue: conversationResult.shouldContinue,
        suggestedActions: conversationResult.suggestedActions,
      };
    } catch (error) {
      logger.error('Error processing voice message:', error);
      throw error;
    } finally {
      // Clean up temporary files
      this.cleanupTempFiles();
    }
  }

  /**
   * Clean up temporary files to prevent disk space issues
   */
  private cleanupTempFiles(): void {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      files.forEach(file => {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        // Delete files older than 5 minutes
        if (now - stats.mtime.getTime() > maxAge) {
          try {
            fs.unlinkSync(filePath);
            logger.debug(`Cleaned up old temp file: ${file}`);
          } catch (err) {
            logger.warn(`Failed to clean up temp file: ${file}`, err);
          }
        }
      });
    } catch (error) {
      logger.warn('Error during temp file cleanup:', error);
    }
  }

  // Legacy method for backward compatibility
  async processVoiceMessageLegacy(
    audioBuffer: Buffer,
    userId: string,
    context?: any
  ): Promise<{
    transcript: string;
    intent: string;
    response: string;
    audioResponse: Buffer;
  }> {
    try {
      // Convert OGG to WAV for Whisper
      const wavPath = await this.convertOggToWav(audioBuffer);
      
      // Transcribe audio
      const transcript = await whisperService.transcribe(wavPath);
      logger.info(`Transcript: ${transcript}`);
      
      // Detect intent
      const intentResult = await gpt4Service.detectIntent(transcript);
      const intent = intentResult.intent;
      logger.info(`Detected intent: ${intent}`);
      
      // Generate response based on intent and context
      const response = await gpt4Service.generateVoiceResponse(
        transcript
      );
      logger.info(`Response: ${response}`);
      
      // Convert response to speech
      const audioResponse = await elevenLabsService.synthesize(response);
      
      return {
        transcript,
        intent: intentResult.intent,
        response,
        audioResponse,
      };
    } catch (error) {
      logger.error('Error processing voice message:', error);
      throw error;
    }
  }



  // Performance monitoring
  getPerformanceMetrics(): {
    averageProcessingTime: number;
    totalProcessed: number;
    errorRate: number;
    costEfficiency: number;
  } {
    // This would be implemented with actual metrics tracking
    return {
      averageProcessingTime: 2500, // ms
      totalProcessed: 100,
      errorRate: 0.05,
      costEfficiency: 0.85
    };
  }
}

export default new VoiceProcessor();
