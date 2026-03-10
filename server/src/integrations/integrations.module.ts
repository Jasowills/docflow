import { Module } from '@nestjs/common';
import { GithubController } from './github.controller';
import { GithubRepository } from './github.repository';
import { GithubService } from './github.service';

@Module({
  controllers: [GithubController],
  providers: [GithubRepository, GithubService],
  exports: [GithubRepository, GithubService],
})
export class IntegrationsModule {}
