import { Controller, Get, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { AppConfigModule } from "./config/config.module";
import { Public } from "./auth/decorators";
import { DatabaseModule } from "./database/database.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RecordingsModule } from "./recordings/recordings.module";
import { DocumentsModule } from "./documents/documents.module";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";
import { SpeechModule } from "./speech/speech.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { RealtimeModule } from "./realtime/realtime.module";
import { ExtensionsModule } from "./extensions/extensions.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { TestPlansModule } from "./test-plans/test-plans.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { DashboardModule } from "./dashboard/dashboard.module";

@Controller()
class AppController {
  @Get()
  @Public()
  getRoot() {
    return "server running";
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    AppConfigModule,
    DatabaseModule,
    CommonModule,
    AuthModule,
    RecordingsModule,
    DocumentsModule,
    AdminModule,
    AiModule,
    SpeechModule,
    RealtimeModule,
    ExtensionsModule,
    IntegrationsModule,
    TestPlansModule,
    WorkspacesModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
