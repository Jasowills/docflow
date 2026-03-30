import { Body, Controller, Get, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, Public } from "./decorators";
import { AuthService } from "./auth.service";
import { UploadTokenService } from "./upload-token.service";
import type { UserContext } from "@docflow/shared";
import type { Request } from "express";
import {
  LoginDto,
  LogtoProfileSyncDto,
  RefreshTokenDto,
  RegisterDto,
  GoogleCallbackDto,
  AccountSetupDto,
} from "./dto/auth.dto";
import { AppConfig } from "../config/app-config";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly uploadTokenService: UploadTokenService,
    private readonly config: AppConfig,
  ) {}

  @Public()
  @Get("providers")
  @ApiOperation({ summary: "Get enabled sign-in providers" })
  getProviders() {
    const googleSignInEnabled = !!this.config.googleClientId;

    return {
      primaryProvider: this.config.authProvider === "logto" ? "logto" : "jwt",
      googleSignInEnabled,
      googleClientId: googleSignInEnabled
        ? this.config.googleClientId
        : undefined,
      googleCallbackUrl: googleSignInEnabled
        ? this.config.googleCallbackUrl
        : undefined,
    };
  }

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Create a new DocFlow account" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Sign in with email and password" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("google/callback")
  @ApiOperation({ summary: "Exchange Google OAuth authorization code for DocFlow tokens" })
  googleCallback(@Body() dto: GoogleCallbackDto) {
    return this.authService.googleAuth(dto.code);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Refresh an access token" })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post("logto-bootstrap")
  @ApiOperation({
    summary: "Bootstrap or sync a local DocFlow user from Logto profile data",
  })
  bootstrapLogtoProfile(
    @CurrentUser() user: UserContext,
    @Body() body: LogtoProfileSyncDto,
  ) {
    return this.authService.bootstrapLogtoUser(user, body);
  }

  @ApiBearerAuth()
  @Get("me")
  @ApiOperation({ summary: "Get the authenticated user profile" })
  me(@CurrentUser() user: UserContext) {
    return this.authService.me(user.userId);
  }

  @ApiBearerAuth()
  @Post("logto-profile-sync")
  @ApiOperation({
    summary: "Sync Logto profile data into the authenticated DocFlow user",
  })
  syncLogtoProfile(
    @CurrentUser() user: UserContext,
    @Body() body: LogtoProfileSyncDto,
  ) {
    return this.authService.syncLogtoProfile(user.userId, body);
  }

  @ApiBearerAuth()
  @Patch("onboarding")
  @ApiOperation({
    summary: "Update onboarding progress for the authenticated user",
  })
  updateOnboarding(
    @CurrentUser() user: UserContext,
    @Body() body: { completed?: boolean; state?: Record<string, unknown> },
  ) {
    return this.authService.updateOnboarding(user.userId, body);
  }

  @ApiBearerAuth()
  @Patch("account-setup")
  @ApiOperation({
    summary: "Set account type and team name after Google sign-up",
  })
  updateAccountSetup(
    @CurrentUser() user: UserContext,
    @Body() dto: AccountSetupDto,
  ) {
    return this.authService.updateAccountSetup(user.userId, dto);
  }

  @ApiBearerAuth()
  @Post("extension-upload-token")
  @ApiOperation({ summary: "Create a short-lived token for extension uploads" })
  createExtensionUploadToken(
    @CurrentUser() user: UserContext,
    @Req() req: Request,
  ) {
    const remainingSeconds = getRemainingBearerTokenSeconds(req);
    return this.uploadTokenService.createUploadToken(user, remainingSeconds);
  }
}

function getRemainingBearerTokenSeconds(req: Request): number | undefined {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return undefined;
  const parts = token.split(".");
  if (parts.length < 2) return undefined;
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (!payload.exp) return undefined;
    const nowSec = Math.floor(Date.now() / 1000);
    const remaining = payload.exp - nowSec;
    return remaining > 0 ? remaining : undefined;
  } catch {
    return undefined;
  }
}
