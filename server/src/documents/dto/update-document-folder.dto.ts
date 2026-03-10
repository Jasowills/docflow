import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDocumentFolderDto {
  @ApiProperty({
    description: 'Folder name to assign to this document',
    example: 'applications',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  folder!: string;
}
