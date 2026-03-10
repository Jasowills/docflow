import { Body, Controller, Get, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../auth/decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PublishExtensionReleaseDto } from './dto/publish-extension-release.dto';
import { ExtensionPublishGuard } from './extension-publish.guard';
import { ExtensionsService } from './extensions.service';
import type { UserContext } from '@docflow/shared';

@ApiTags('Extensions')
@Controller('extensions/releases')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Get('latest')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get latest published extension release metadata' })
  async getLatest() {
    const latest = await this.extensionsService.getLatestRelease();
    if (!latest) {
      throw new NotFoundException('No extension release published yet');
    }
    return latest;
  }

  @Post('publish')
  @Public()
  @UseGuards(ExtensionPublishGuard)
  @ApiOperation({ summary: 'Publish extension release metadata (pipeline)' })
  @ApiHeader({
    name: 'x-extension-publish-key',
    required: true,
    description: 'Server-to-server secret key for extension publish pipeline',
  })
  async publish(
    @Body() dto: PublishExtensionReleaseDto,
    @CurrentUser() user?: UserContext,
  ) {
    return this.extensionsService.publishRelease(dto, user);
  }
}

