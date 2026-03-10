import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { UploadTokenGuard } from '../auth/upload-token.guard';
import { Public } from '../auth/decorators';
import { SpeechService } from './speech.service';

@ApiTags('Speech')
@ApiBearerAuth()
@Controller('speech')
export class SpeechController {
  private readonly logger = new Logger(SpeechController.name);
  constructor(private readonly speechService: SpeechService) {}

  @Post('transcribe')
  @Public()
  @UseGuards(UploadTokenGuard)
  @ApiOperation({ summary: 'Transcribe an audio file to text segments' })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'language', required: false, example: 'en-AU' })
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max
      fileFilter: (_req, file, cb) => {
        if (
          file.mimetype === 'audio/wav' ||
          file.mimetype === 'audio/x-wav' ||
          file.originalname.toLowerCase().endsWith('.wav')
        ) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only WAV audio files are accepted'), false);
        }
      },
    }),
  )
  async transcribe(
    @UploadedFile() file: Express.Multer.File,
    @Query('language') language?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('No audio file provided');
    }
    const selectedLanguage = language || 'en-AU';
    this.logger.log(
      `Transcription request received: bytes=${file.buffer.length}, mimetype=${file.mimetype}, language=${selectedLanguage}`,
    );
    try {
      const segments = await this.speechService.transcribe(
        file.buffer,
        selectedLanguage,
      );
      this.logger.log(
        `Transcription request completed: segments=${segments.length}, language=${selectedLanguage}`,
      );
      return { segments };
    } catch (error) {
      this.logger.error(
        `Transcription request failed: language=${selectedLanguage}, bytes=${file.buffer.length}, error=${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
