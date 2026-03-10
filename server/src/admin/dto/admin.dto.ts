import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateGlobalPromptDto {
  @ApiProperty({ description: 'The global system prompt text' })
  @IsString()
  globalSystemPrompt!: string;
}

export class UpsertDocumentTypeDto {
  @ApiProperty({ description: 'Unique key for the document type', example: 'user_reference' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Display name', example: 'User Reference Documentation' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Description of the document type' })
  @IsString()
  description!: string;

  @ApiProperty({ description: 'System prompt for this document type' })
  @IsString()
  systemPrompt!: string;

  @ApiProperty({ description: 'Whether this document type is active' })
  @IsBoolean()
  isActive!: boolean;

  @ApiPropertyOptional({ description: 'Sort order for display', default: 99 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UpsertFolderConfigDto {
  @ApiProperty({ description: 'Folder key (matches document folder value)', example: 'applications' })
  @IsString()
  key!: string;

  @ApiProperty({ description: 'Folder display name', example: 'Applications' })
  @IsString()
  displayName!: string;

  @ApiPropertyOptional({ description: 'Short tag shown on document cards', example: 'D365BC' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Short subtitle under folder title' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Preview image URL for folder card' })
  @IsOptional()
  @IsString()
  previewImageUrl?: string;

  @ApiPropertyOptional({ description: 'Sort order for display', default: 99 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}

export class UploadFolderPreviewImageDto {
  @ApiProperty({ description: 'Image data URL', example: 'data:image/png;base64,...' })
  @IsString()
  dataUrl!: string;

  @ApiPropertyOptional({ description: 'Folder key for organizing blob path', example: 'applications' })
  @IsOptional()
  @IsString()
  folderKey?: string;
}
