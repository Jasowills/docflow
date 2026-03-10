import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class PublishExtensionReleaseDto {
  @ApiProperty({ example: '0.1.3' })
  @IsString()
  version!: string;

  @ApiProperty({ example: 'https://cdn.example.com/routectrl-recorder/0.1.3.zip' })
  @IsString()
  @IsUrl({ require_tld: false })
  downloadUrl!: string;

  @ApiPropertyOptional({ example: 'Includes transcript capture improvements' })
  @IsOptional()
  @IsString()
  notes?: string;
}
