import OpenAI from 'openai';
import config from '../utils/config';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

export class WhisperService {
  async transcribe(audioFilePath: string): Promise<string> {
    try {
      logger.info(`Transcribing audio file: ${audioFilePath}`);
      
      // Create a readable stream from the file
      const audioFile = fs.createReadStream(audioFilePath);
      
      const response = await openai.audio.transcriptions.create({
        file: audioFile,
        model: config.openai.whisperModel,
        language: 'en',
        response_format: 'text',
      });

      logger.info('Transcription completed successfully');
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(audioFilePath);
      } catch (err) {
        logger.warn(`Failed to delete temp file: ${audioFilePath}`);
      }

      return response;
    } catch (error) {
      logger.error('Error transcribing audio:', error);
      
      // Clean up on error
      try {
        if (fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
        }
      } catch (err) {
        logger.warn(`Failed to delete temp file on error: ${audioFilePath}`);
      }
      
      throw error;
    }
  }

  async transcribeBuffer(audioBuffer: Buffer, filename: string = 'audio.ogg'): Promise<string> {
    // Save buffer to temporary file
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, `${Date.now()}-${filename}`);
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    // Transcribe the file
    return this.transcribe(tempFilePath);
  }
}

export default new WhisperService();
