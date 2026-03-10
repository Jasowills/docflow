import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString } from 'class-validator';

export class InviteWorkspaceMemberDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['admin', 'editor', 'viewer'] })
  @IsIn(['admin', 'editor', 'viewer'])
  role!: 'admin' | 'editor' | 'viewer';
}

export class UpdateWorkspaceMemberRoleDto {
  @ApiProperty({ enum: ['owner', 'admin', 'editor', 'viewer'] })
  @IsString()
  @IsIn(['owner', 'admin', 'editor', 'viewer'])
  role!: 'owner' | 'admin' | 'editor' | 'viewer';
}
