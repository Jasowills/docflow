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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, Public } from '../auth/decorators';
import { UploadTokenGuard } from '../auth/upload-token.guard';
import { RecordingsService } from './recordings.service';
import { UploadRecordingDto } from './dto/upload-recording.dto';
import type { UserContext, RecordingListQuery } from '@docflow/shared';

@ApiTags('Recordings')
@ApiBearerAuth()
@Controller('recordings')
export class RecordingsController {
  constructor(private readonly recordingsService: RecordingsService) {}

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

