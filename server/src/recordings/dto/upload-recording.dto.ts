import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { RecordingEventType } from '@docflow/shared';

const RECORDING_EVENT_TYPES = [
  'navigation',
  'click',
  'input',
  'modal_open',
  'modal_close',
  'scroll',
  'custom',
] as const;

export class RecordingMetadataDto {
  @ApiProperty() @IsString() recordingId!: string;
  @ApiProperty() @IsString() name!: string;
  @ApiProperty() @IsString() createdAtUtc!: string;
  @ApiProperty() @IsString() createdBy!: string;
  @ApiProperty() @IsString() productName!: string;
  @ApiProperty() @IsString() productArea!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() applicationVersion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() environment?: string;
}

export class RecordingEventDto {
  @ApiProperty() @IsNumber() timestampMs!: number;
  @ApiProperty() @IsIn(RECORDING_EVENT_TYPES) type!: RecordingEventType;
  @ApiPropertyOptional() @IsOptional() @IsString() url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() selector?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fieldName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() value?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() eventContext?: string;
}

export class SpeechTranscriptDto {
  @ApiProperty() @IsNumber() timestampMs!: number;
  @ApiProperty() @IsString() speaker!: string;
  @ApiProperty() @IsString() text!: string;
}

export class RecordingScreenshotDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsNumber() timestampMs!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() eventSequence?: number;
  @ApiProperty()
  @IsIn(['click', 'form_interaction', 'navigation', 'state_change'])
  reason!: 'click' | 'form_interaction' | 'navigation' | 'state_change';
  @ApiPropertyOptional() @IsOptional() @IsString() url?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() selector?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() label?: string;
  @ApiProperty() @IsString() imageDataUrl!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() thumbnailDataUrl?: string;
}

export class UploadRecordingDto {
  @ApiProperty({ type: RecordingMetadataDto })
  @ValidateNested()
  @Type(() => RecordingMetadataDto)
  metadata!: RecordingMetadataDto;

  @ApiProperty({ type: [RecordingEventDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordingEventDto)
  events!: RecordingEventDto[];

  @ApiProperty({ type: [SpeechTranscriptDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpeechTranscriptDto)
  speechTranscripts!: SpeechTranscriptDto[];

  @ApiPropertyOptional({ type: [RecordingScreenshotDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordingScreenshotDto)
  screenshots?: RecordingScreenshotDto[];
}


