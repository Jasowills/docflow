import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Public } from '../auth/decorators';
import { UploadTokenGuard } from '../auth/upload-token.guard';
import { RecordingsService } from './recordings.service';
import { RecordingStorageService } from './recording-storage.service';
import { UploadRecordingDto } from './dto/upload-recording.dto';
import type { UserContext, RecordingListQuery } from '@docflow/shared';
import type { Request } from 'express';
import { gunzipSync } from 'zlib';

@ApiTags('Recordings')
@ApiBearerAuth()
@Controller('recordings')
export class RecordingsController {
  constructor(
    private readonly recordingsService: RecordingsService,
    private readonly recordingStorageService: RecordingStorageService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a recording JSON' })
  async upload(
    @Body() dto: UploadRecordingDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.recordingsService.upload(dto, user);
  }

  @Post('extension-upload')
  @Public()
  @UseGuards(UploadTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload recording from extension token' })
  async extensionUpload(
    @Body() dto: UploadRecordingDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.recordingsService.upload(dto, user);
  }

  /**
   * Accepts gzip-compressed recording payloads to bypass Vercel's 4.5MB limit.
   * The extension sends the upload token via `X-Upload-Token` header.
   * Raw body is provided by express.raw() middleware in main.ts.
   */
  @Post('extension-upload-raw')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload gzip-compressed recording from extension' })
  async extensionUploadRaw(
    @Req() req: Request,
  ) {
    const token = req.headers['x-upload-token'] as string;
    if (!token) {
      throw new BadRequestException('Missing X-Upload-Token header');
    }

    let body: Buffer;
    if (req.headers['content-encoding'] === 'gzip' || req.headers['content-type'] === 'application/octet-stream') {
      // Raw binary from express.raw() or gzipped body
      body = req.body as Buffer;
      if (!Buffer.isBuffer(body)) {
        throw new BadRequestException('Expected binary request body');
      }
    } else {
      throw new BadRequestException('Expected gzip or binary request body');
    }

    // Decompress gzip if needed
    let jsonBody: string;
    if (req.headers['content-encoding'] === 'gzip') {
      jsonBody = gunzipSync(body).toString('utf8');
    } else {
      jsonBody = body.toString('utf8');
    }

    let dto: UploadRecordingDto;
    try {
      dto = JSON.parse(jsonBody);
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    // Validate the upload token and extract user context
    const user = this.recordingsService.validateUploadToken(token);
    return this.recordingsService.upload(dto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List recordings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'productArea', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async list(
    @CurrentUser() user: UserContext,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('productArea') productArea?: string,
    @Query('search') search?: string,
  ) {
    const query: RecordingListQuery = {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      productArea,
      search,
    };
    return this.recordingsService.list(query, user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a specific recording by ID' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.recordingsService.getById(id, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a recording by ID' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.recordingsService.delete(id, user);
  }
}

