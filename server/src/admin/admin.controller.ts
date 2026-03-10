import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/decorators';
import { AdminService } from './admin.service';
import {
  UpdateGlobalPromptDto,
  UpsertDocumentTypeDto,
  UpsertFolderConfigDto,
  UploadFolderPreviewImageDto,
} from './dto/admin.dto';
import type { UserContext } from '@docflow/shared';

@ApiTags('Admin Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('config')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get current system configuration' })
  async getConfig() {
    return this.adminService.getConfig();
  }

  @Put('global-prompt')
  @ApiOperation({ summary: 'Update the global system prompt' })
  async updateGlobalPrompt(
    @Body() dto: UpdateGlobalPromptDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.adminService.updateGlobalPrompt(
      dto.globalSystemPrompt,
      user,
    );
  }

  @Post('document-types')
  @ApiOperation({ summary: 'Create or update a document type' })
  async upsertDocumentType(
    @Body() dto: UpsertDocumentTypeDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.adminService.upsertDocumentType(dto, user);
  }

  @Delete('document-types/:key')
  @ApiOperation({ summary: 'Delete a document type' })
  async deleteDocumentType(
    @Param('key') key: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.adminService.deleteDocumentType(key, user);
  }

  @Post('folder-configs')
  @ApiOperation({ summary: 'Create or update a folder card config' })
  async upsertFolderConfig(
    @Body() dto: UpsertFolderConfigDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.adminService.upsertFolderConfig(dto, user);
  }

  @Delete('folder-configs/:key')
  @ApiOperation({ summary: 'Delete a folder card config' })
  async deleteFolderConfig(
    @Param('key') key: string,
    @CurrentUser() user: UserContext,
  ) {
    return this.adminService.deleteFolderConfig(key, user);
  }

  @Post('folder-configs/upload-image')
  @ApiOperation({ summary: 'Upload folder preview image to blob storage' })
  async uploadFolderPreviewImage(
    @Body() dto: UploadFolderPreviewImageDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.adminService.uploadFolderPreviewImage(dto.dataUrl, dto.folderKey, user);
  }
}

