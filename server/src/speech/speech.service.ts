import { Injectable, Logger } from '@nestjs/common';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { AppConfig } from '../config/app-config';
import type { SpeechTranscriptSegment } from '@docflow/shared';

@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  constructor(private readonly config: AppConfig) {}

  /**
   * Transcribe an audio buffer using Azure AI Speech.
   * Returns an array of time-aligned transcript segments.
   */
  async transcribe(
    audioBuffer: Buffer,
    language: string = 'en-AU',
  ): Promise<SpeechTranscriptSegment[]> {
    const endpoint = this.config.azureSpeechEndpoint.trim();
    const usingEndpoint = endpoint.length > 0;
    this.logger.log(
      `Starting Azure Speech transcription: bytes=${audioBuffer.length}, language=${language}, mode=${usingEndpoint ? 'endpoint' : 'region'}, region=${this.config.azureSpeechRegion}`,
    );
    const wavInfo = this.parseWavBuffer(audioBuffer);
    if (!wavInfo) {
      this.logger.error(
        `WAV parse failed: bytes=${audioBuffer.length}, language=${language}`,
      );
      throw new Error('Invalid WAV audio payload');
    }
    this.logger.log(
      `WAV parsed: sampleRate=${wavInfo.sampleRate}, channels=${wavInfo.channels}, bitsPerSample=${wavInfo.bitsPerSample}, pcmBytes=${wavInfo.pcmData.length}`,
    );

    try {
      const segments = await this.transcribeViaSdk(wavInfo, language, usingEndpoint);
      if (segments.length === 0) {
        this.logger.warn(
          `Azure Speech SDK returned zero segments: language=${language}`,
        );
      } else {
        this.logger.log(`Transcription complete via SDK: ${segments.length} segments`);
      }
      return segments;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Speech SDK path failed; attempting REST fallback. error=${message}`,
      );
      const segments = await this.transcribeViaRest(audioBuffer, language);
      if (segments.length === 0) {
        this.logger.warn(
          `Azure Speech REST returned zero segments: language=${language}`,
        );
      } else {
        this.logger.log(`Transcription complete via REST: ${segments.length} segments`);
      }
      return segments;
    }
  }

  private async transcribeViaSdk(
    wavInfo: {
      sampleRate: number;
      channels: number;
      bitsPerSample: number;
      pcmData: Buffer;
    },
    language: string,
    usingEndpoint: boolean,
  ): Promise<SpeechTranscriptSegment[]> {
    let speechConfig: sdk.SpeechConfig;
    if (usingEndpoint) {
      try {
        const UrlCtor = (globalThis as any).URL;
        if (typeof UrlCtor !== 'function') {
          throw new Error('URL constructor is unavailable');
        }
        speechConfig = sdk.SpeechConfig.fromEndpoint(
          new UrlCtor(this.config.azureSpeechEndpoint),
          this.config.azureSpeechKey,
        );
      } catch {
        throw new Error('Invalid AZURE_SPEECH_ENDPOINT URL');
      }
    } else {
      speechConfig = sdk.SpeechConfig.fromSubscription(
        this.config.azureSpeechKey,
        this.config.azureSpeechRegion,
      );
    }
    speechConfig.speechRecognitionLanguage = language;
    speechConfig.requestWordLevelTimestamps();

    const pushStream = sdk.AudioInputStream.createPushStream(
      sdk.AudioStreamFormat.getWaveFormatPCM(
        wavInfo.sampleRate,
        wavInfo.bitsPerSample,
        wavInfo.channels,
      ),
    );
    const pcmBytes = Uint8Array.from(wavInfo.pcmData);
    pushStream.write(pcmBytes.buffer);
    pushStream.close();

    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
    const segments: SpeechTranscriptSegment[] = [];

    return new Promise<SpeechTranscriptSegment[]>((resolve, reject) => {
      let resolvedOrRejected = false;
      const finishReject = (err: Error) => {
        if (resolvedOrRejected) return;
        resolvedOrRejected = true;
        recognizer.close();
        reject(err);
      };
      const finishResolve = () => {
        if (resolvedOrRejected) return;
        resolvedOrRejected = true;
        recognizer.close();
        resolve(segments);
      };

      recognizer.recognized = (_sender, event) => {
        if (
          event.result.reason === sdk.ResultReason.RecognizedSpeech &&
          event.result.text
        ) {
          segments.push({
            timestampMs: Math.round(event.result.offset / 10000),
            speaker: 'host',
            text: event.result.text,
          });
        }
      };

      recognizer.canceled = (_sender, event) => {
        if (event.reason === sdk.CancellationReason.Error) {
          const details = event.errorDetails || 'Unknown SDK cancellation error';
          this.logger.error(
            `Speech recognition error: code=${event.errorCode}, details=${details}`,
          );
          finishReject(new Error(`Speech recognition failed: ${details}`));
          return;
        }
        finishResolve();
      };

      recognizer.sessionStopped = () => {
        finishResolve();
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          this.logger.debug('Speech recognition started');
        },
        (error) => {
          const msg = String(error);
          this.logger.error(`Failed to start speech recognition: ${msg}`);
          finishReject(new Error(msg));
        },
      );
    });
  }

  private async transcribeViaRest(
    audioBuffer: Buffer,
    language: string,
  ): Promise<SpeechTranscriptSegment[]> {
    const endpoint = this.buildSpeechRestEndpoint(language);
    const region = this.config.azureSpeechRegion.trim();
    const headers: Record<string, string> = {
      'Ocp-Apim-Subscription-Key': this.config.azureSpeechKey,
      'Content-Type': 'audio/wav; codecs=audio/pcm',
      Accept: 'application/json;text/xml',
    };
    if (region.length > 0) {
      headers['Ocp-Apim-Subscription-Region'] = region;
    }
    this.logger.log(`Azure Speech REST fallback request: endpoint=${endpoint}, bytes=${audioBuffer.length}, language=${language}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: audioBuffer,
    });

    const bodyText = await response.text();
    if (!response.ok) {
      this.logger.error(
        `Azure Speech REST failed: status=${response.status}, body=${bodyText.slice(0, 500)}`,
      );
      throw new Error(`Speech recognition failed: REST ${response.status}`);
    }

    let parsed: {
      DisplayText?: string;
      NBest?: Array<{ Display?: string }>;
      RecognitionStatus?: string;
    } = {};
    try {
      parsed = JSON.parse(bodyText) as typeof parsed;
    } catch {
      // Keep parsed empty; handled below.
    }

    const text =
      parsed.DisplayText?.trim() ||
      parsed.NBest?.[0]?.Display?.trim() ||
      '';
    if (!text) {
      this.logger.warn(
        `Azure Speech REST returned empty transcript. status=${parsed.RecognitionStatus || 'unknown'}`,
      );
      return [];
    }

    return [
      {
        timestampMs: 0,
        speaker: 'host',
        text,
      },
    ];
  }

  private buildSpeechRestEndpoint(language: string): string {
    const endpoint = this.config.azureSpeechEndpoint.trim();
    const languageParam = `language=${encodeURIComponent(language)}`;
    const formatParam = 'format=detailed';
    if (endpoint) {
      const base = endpoint.replace(/\/+$/, '');
      return `${base}/speech/recognition/conversation/cognitiveservices/v1?${languageParam}&${formatParam}`;
    }
    const region = this.config.azureSpeechRegion.trim();
    return `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?${languageParam}&${formatParam}`;
  }

  private parseWavBuffer(buffer: Buffer): {
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    pcmData: Buffer;
  } | null {
    if (buffer.length < 44) return null;
    if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
    if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null;

    let offset = 12;
    let sampleRate = 0;
    let channels = 0;
    let bitsPerSample = 0;
    let dataStart = 0;
    let dataLength = 0;

    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('ascii', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      const chunkDataStart = offset + 8;
      const nextChunk = chunkDataStart + chunkSize + (chunkSize % 2);

      if (chunkDataStart + chunkSize > buffer.length) return null;

      if (chunkId === 'fmt ') {
        const audioFormat = buffer.readUInt16LE(chunkDataStart);
        channels = buffer.readUInt16LE(chunkDataStart + 2);
        sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
        bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
        if (audioFormat !== 1) return null; // PCM only
      } else if (chunkId === 'data') {
        dataStart = chunkDataStart;
        dataLength = chunkSize;
      }

      offset = nextChunk;
    }

    if (!sampleRate || !channels || !bitsPerSample || !dataStart || !dataLength) {
      return null;
    }

    return {
      sampleRate,
      channels,
      bitsPerSample,
      pcmData: buffer.subarray(dataStart, dataStart + dataLength),
    };
  }
}

