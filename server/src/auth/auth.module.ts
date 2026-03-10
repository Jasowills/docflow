import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { UploadTokenService } from './upload-token.service';
import { UploadTokenGuard } from './upload-token.guard';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from './auth.service';
import { UsersRepository } from './users.repository';
import { WorkspacesRepository } from './workspaces.repository';

@Module({
  controllers: [AuthController],
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    UploadTokenService,
    UploadTokenGuard,
    AuthService,
    UsersRepository,
    WorkspacesRepository,
  ],
  exports: [
    PassportModule,
    JwtAuthGuard,
    RolesGuard,
    UploadTokenService,
    UploadTokenGuard,
    AuthService,
    UsersRepository,
    WorkspacesRepository,
  ],
})
export class AuthModule {}
