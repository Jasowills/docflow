import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GithubController } from './github.controller';
import { GithubRepository } from './github.repository';
import { GithubService } from './github.service';

@Module({
  imports: [AuthModule],
  controllers: [GithubController],
  providers: [GithubRepository, GithubService],
  exports: [GithubRepository, GithubService],
})
export class IntegrationsModule {}
