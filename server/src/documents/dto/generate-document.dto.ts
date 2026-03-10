import { IsString, IsArray, IsOptional, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class TestCaseContextDto {
  @ApiPropertyOptional({ description: 'Specific feature or module under test' })
  @IsOptional()
  @IsString()
  featureName?: string;

  @ApiPropertyOptional({ description: 'Primary user or persona expected to run the workflow' })
  @IsOptional()
  @IsString()
  targetPersona?: string;

  @ApiPropertyOptional({ description: 'Acceptance criteria or business outcomes the feature must satisfy' })
  @IsOptional()
  @IsString()
  acceptanceCriteria?: string;

  @ApiPropertyOptional({ description: 'Environment or execution context relevant for test coverage' })
  @IsOptional()
  @IsString()
  environmentContext?: string;

  @ApiPropertyOptional({ description: 'Overall business or implementation risk to bias test priorities' })
  @IsOptional()
  @IsString()
  riskLevel?: string;

  @ApiPropertyOptional({ description: 'Explicit items that should be excluded from generated coverage' })
  @IsOptional()
  @IsString()
  outOfScope?: string;
}

export class GenerateDocumentDto {
  @ApiProperty({ description: 'Recording ID to generate documentation from' })
  @IsString()
  recordingId!: string;

  @ApiProperty({
    description: 'Document type keys to generate',
    example: ['user_reference', 'tutorial'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  documentTypes!: string[];

  @ApiProperty({ description: 'Title for the generated document(s)' })
  @IsString()
  documentTitle!: string;

  @ApiPropertyOptional({
    description: 'Free-text guidance to shape AI output',
    example: 'Focus on the multi-day planning workflow. Target audience is waste operators.',
  })
  @IsOptional()
  @IsString()
  guidance?: string;

  @ApiPropertyOptional({
    description: 'Target locale / language',
    example: 'en-AU',
  })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({
    description: 'Folder where generated documents should be saved',
    example: 'Applications',
  })
  @IsOptional()
  @IsString()
  folder?: string;

  @ApiPropertyOptional({
    description: 'Structured inputs used primarily for generating test case suites',
    type: TestCaseContextDto,
  })
  @IsOptional()
  testCaseContext?: TestCaseContextDto;
}
