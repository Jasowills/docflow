import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { DocumentsService } from './documents.service';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { UpdateDocumentFolderDto } from './dto/update-document-folder.dto';
import type { UserContext, DocumentListQuery } from '@docflow/shared';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate documentation from a recording' })
  async generate(
    @Body() dto: GenerateDocumentDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentsService.generate(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List generated documents for all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'documentType', required: false, type: String })
  @ApiQuery({ name: 'productArea', required: false, type: String })
  @ApiQuery({ name: 'folder', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async list(
    @CurrentUser() user: UserContext,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('documentType') documentType?: string,
    @Query('productArea') productArea?: string,
    @Query('folder') folder?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    const query: DocumentListQuery = {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      documentType,
      productArea,
      folder,
      dateFrom,
      dateTo,
      search,
    };
    return this.documentsService.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a generated document by ID' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentsService.getById(id, user);
  }

  @Patch(':id/folder')
  @ApiOperation({ summary: 'Move a generated document to a folder' })
  async updateFolder(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentFolderDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentsService.updateFolder(id, dto.folder, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a generated document' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentsService.delete(id, user);
  }
}

