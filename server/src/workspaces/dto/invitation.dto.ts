import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'The invitation token (invitationId)' })
  @IsString()
  token!: string;
}
