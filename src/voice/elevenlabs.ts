import axios from 'axios';
import config from '../utils/config';
import logger from '../utils/logger';

export class ElevenLabsService {
  private apiUrl = 'https://api.elevenlabs.io/v1';
  
  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    try {
      const response = await axios.post(
        `${this.apiUrl}/text-to-speech/${voiceId || config.elevenlabs.voiceId}`,
        {
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': config.elevenlabs.apiKey,
          },
          responseType: 'arraybuffer',
        }
      );

      logger.info('Speech synthesis completed successfully');
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      logger.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  async getVoices(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/voices`, {
        headers: {
          'xi-api-key': config.elevenlabs.apiKey,
        },
      });

      return (response.data as any).voices;
    } catch (error) {
      logger.error('Error fetching voices:', error);
      throw error;
    }
  }
}

export default new ElevenLabsService();
