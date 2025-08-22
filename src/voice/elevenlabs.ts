import axios from 'axios';
import config from '../utils/config';
import logger from '../utils/logger';

interface VoiceOptions {
  voice?: string;
  speed?: number;
  mood?: 'friendly' | 'professional' | 'urgent';
  style?: 'conversational' | 'formal' | 'casual';
}

export class ElevenLabsService {
  private apiUrl = 'https://api.elevenlabs.io/v1';
  private voiceMappings = {
    friendly: config.elevenlabs.voiceId,
    professional: config.elevenlabs.voiceId, // Could use different voice ID
    urgent: config.elevenlabs.voiceId, // Could use different voice ID
  };
  
  async synthesize(text: string, options?: VoiceOptions): Promise<Buffer> {
    try {
      const voiceId = options?.voice || this.voiceMappings[options?.mood || 'friendly'] || config.elevenlabs.voiceId;
      const speed = options?.speed || this.getSpeedForMood(options?.mood);
      const style = options?.style || this.getStyleForMood(options?.mood);

      // Adjust text for better speech synthesis
      const processedText = this.processTextForSpeech(text, style);

      const response = await axios.post(
        `${this.apiUrl}/text-to-speech/${voiceId}`,
        {
          text: processedText,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: this.getStyleValue(style),
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

      logger.info(`Speech synthesis completed with mood: ${options?.mood || 'friendly'}`);
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      logger.error('Error synthesizing speech:', error);
      throw error;
    }
  }

  private getSpeedForMood(_mood?: string): number {
    // TODO: Implement mood-based speed adjustment
    return 1.0; // Normal speed for now
  }

  private getStyleForMood(mood?: string): 'conversational' | 'formal' | 'casual' {
    switch (mood) {
      case 'professional':
        return 'formal';
      case 'urgent':
        return 'conversational';
      default:
        return 'conversational';
    }
  }

  private getStyleValue(style: string): number {
    switch (style) {
      case 'formal':
        return 0.3; // More controlled
      case 'casual':
        return 0.8; // More expressive
      default:
        return 0.5; // Balanced
    }
  }

  private processTextForSpeech(text: string, style: string): string {
    let processedText = text;

    // Add natural pauses for better flow
    processedText = processedText.replace(/\./g, '... ');
    processedText = processedText.replace(/,/g, ', ');

    // Add emphasis for important parts
    if (style === 'conversational') {
      // Add slight pauses for natural conversation flow
      processedText = processedText.replace(/(\w+)(\s+)(\w+)/g, '$1$2$3');
    }

    // Ensure proper sentence endings
    if (!processedText.endsWith('.') && !processedText.endsWith('!') && !processedText.endsWith('?')) {
      processedText += '.';
    }

    return processedText;
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

  // Method to get voice characteristics for different moods
  async getVoiceCharacteristics(voiceId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.apiUrl}/voices/${voiceId}`, {
        headers: {
          'xi-api-key': config.elevenlabs.apiKey,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Error fetching voice characteristics:', error);
      throw error;
    }
  }
}

export default new ElevenLabsService();
