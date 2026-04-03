import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString } from 'class-validator';

export class InviteWorkspaceMemberDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['admin', 'editor'] })
  @IsIn(['admin', 'editor'])
  role!: 'admin' | 'editor';
}

export class UpdateWorkspaceMemberRoleDto {
  @ApiProperty({ enum: ['owner', 'admin', 'editor'] })
  @IsString()
  @IsIn(['owner', 'admin', 'editor'])
  role!: 'owner' | 'admin' | 'editor';
}

export class SwitchWorkspaceDto {
  @ApiProperty({ description: 'The workspace ID to switch to' })
  @IsString()
  workspaceId!: string;
}
