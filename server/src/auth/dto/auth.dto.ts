import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ['individual', 'team'] })
  @IsIn(['individual', 'team'])
  accountType!: 'individual' | 'team';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamName?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class LogtoProfileSyncDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;
}

export class GoogleCallbackDto {
  @ApiProperty()
  @IsString()
  code!: string;
}

export class AccountSetupDto {
  @ApiProperty({ enum: ['individual', 'team'] })
  @IsIn(['individual', 'team'])
  accountType!: 'individual' | 'team';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  teamName?: string;
}
