import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppConfig {
  constructor(private readonly configService: ConfigService) {}

  get supabaseUrl(): string {
    return this.configService.get<string>("SUPABASE_URL", "");
  }

  get supabaseAnonKey(): string {
    return this.configService.get<string>("SUPABASE_ANON_KEY", "");
  }

  get supabaseServiceRoleKey(): string {
    return this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY", "");
  }

  get supabaseDbSchema(): string {
    return this.configService.get<string>("SUPABASE_DB_SCHEMA", "public");
  }

  get authProvider(): string {
    return this.configService.get<string>("AUTH_PROVIDER", "jwt");
  }

  get logtoEndpoint(): string {
    return this.configService.get<string>("LOGTO_ENDPOINT", "");
  }

  get logtoIssuer(): string {
    const endpoint = this.logtoEndpoint.trim().replace(/\/+$/, "");
    return endpoint ? `${endpoint}/oidc` : "";
  }

  get logtoJwksUri(): string {
    const issuer = this.logtoIssuer;
    return issuer ? `${issuer}/jwks` : "";
  }

  get logtoUserInfoEndpoint(): string {
    const issuer = this.logtoIssuer;
    return issuer ? `${issuer}/me` : "";
  }

  get logtoAppId(): string {
    return this.configService.get<string>("LOGTO_APP_ID", "");
  }

  get logtoAppSecret(): string {
    return this.configService.get<string>("LOGTO_APP_SECRET", "");
  }

  get logtoApiResource(): string {
    return this.configService.get<string>("LOGTO_API_RESOURCE", "");
  }

  get logtoCallbackUrl(): string {
    return this.configService.get<string>("LOGTO_CALLBACK_URL", "");
  }

  get logtoSignInUrl(): string {
    return this.configService.get<string>("LOGTO_SIGN_IN_URL", "");
  }

  get logtoGithubSignInUrl(): string {
    return this.configService.get<string>("LOGTO_GITHUB_SIGN_IN_URL", "");
  }

  get logtoGithubIdpName(): string {
    return this.configService.get<string>("LOGTO_GITHUB_IDP_NAME", "github");
  }

  get logtoGoogleSignInUrl(): string {
    return this.configService.get<string>("LOGTO_GOOGLE_SIGN_IN_URL", "");
  }

  get logtoGoogleIdpName(): string {
    return this.configService.get<string>("LOGTO_GOOGLE_IDP_NAME", "google");
  }

  get googleClientId(): string {
    return this.configService.get<string>("GOOGLE_CLIENT_ID", "");
  }

  get googleClientSecret(): string {
    return this.configService.get<string>("GOOGLE_CLIENT_SECRET", "");
  }

  get googleCallbackUrl(): string {
    return this.configService.get<string>(
      "GOOGLE_CALLBACK_URL",
      "http://localhost:3000/auth/google/callback",
    );
  }

  get githubAppId(): string {
    return this.configService.get<string>("GITHUB_APP_ID", "");
  }

  get githubAppSlug(): string {
    return this.configService.get<string>("GITHUB_APP_SLUG", "");
  }

  get githubAppClientId(): string {
    return this.configService.get<string>("GITHUB_APP_CLIENT_ID", "");
  }

  get githubAppClientSecret(): string {
    return this.configService.get<string>("GITHUB_APP_CLIENT_SECRET", "");
  }

  get githubAppPrivateKey(): string {
    return this.configService.get<string>("GITHUB_APP_PRIVATE_KEY", "");
  }

  get githubAppWebhookSecret(): string {
    return this.configService.get<string>("GITHUB_APP_WEBHOOK_SECRET", "");
  }

  get githubAppSetupUrl(): string {
    return this.configService.get<string>("GITHUB_APP_SETUP_URL", "");
  }

  get docflowApiBaseUrl(): string {
    return this.configService.get<string>(
      "DOCFLOW_API_BASE_URL",
      "http://localhost:3001",
    );
  }

  get docflowWebBaseUrl(): string {
    return this.configService.get<string>(
      "DOCFLOW_WEB_BASE_URL",
      "http://localhost:5173",
    );
  }

  get jwtAccessTokenSecret(): string {
    return this.configService.get<string>(
      "JWT_ACCESS_TOKEN_SECRET",
      "docflow-dev-access-secret",
    );
  }

  get jwtRefreshTokenSecret(): string {
    return this.configService.get<string>(
      "JWT_REFRESH_TOKEN_SECRET",
      "docflow-dev-refresh-secret",
    );
  }

  get jwtAccessTokenTtl(): string {
    return this.configService.get<string>("JWT_ACCESS_TOKEN_TTL", "1d");
  }

  get jwtRefreshTokenTtl(): string {
    return this.configService.get<string>("JWT_REFRESH_TOKEN_TTL", "30d");
  }

  get azureSpeechKey(): string {
    return this.configService.get<string>("AZURE_SPEECH_KEY", "");
  }

  get azureSpeechEndpoint(): string {
    return this.configService.get<string>("AZURE_SPEECH_ENDPOINT", "");
  }

  get azureSpeechRegion(): string {
    return this.configService.get<string>(
      "AZURE_SPEECH_REGION",
      "australiaeast",
    );
  }

  get extensionUploadTokenSecret(): string {
    return this.configService.get<string>(
      "EXTENSION_UPLOAD_TOKEN_SECRET",
      "docflow-extension-upload-secret",
    );
  }

  get extensionUploadTokenTtl(): string {
    return this.configService.get<string>("EXTENSION_UPLOAD_TOKEN_TTL", "1d");
  }

  get extensionPublishSecret(): string {
    return this.configService.get<string>(
      "EXTENSION_PUBLISH_SECRET",
      "docflow-extension-publish-secret",
    );
  }

  get aiProvider(): string {
    return this.configService.get<string>("AI_PROVIDER", "openrouter");
  }

  get aiTemperature(): number {
    return parseFloat(this.configService.get<string>("AI_TEMPERATURE", "0.3"));
  }

  get aiMaxTokens(): number {
    return parseInt(
      this.configService.get<string>("AI_MAX_TOKENS", "4096"),
      10,
    );
  }

  get azureOpenAiEndpoint(): string {
    return this.configService.get<string>("AZURE_OPENAI_ENDPOINT", "");
  }

  get azureOpenAiApiKey(): string {
    return this.configService.get<string>("AZURE_OPENAI_API_KEY", "");
  }

  get azureOpenAiDeploymentName(): string {
    return this.configService.get<string>(
      "AZURE_OPENAI_DEPLOYMENT_NAME",
      "gpt-4.1",
    );
  }

  get azureOpenAiApiVersion(): string {
    return this.configService.get<string>(
      "AZURE_OPENAI_API_VERSION",
      "2025-03-01-preview",
    );
  }

  get openAiApiKey(): string {
    return this.configService.get<string>("OPENAI_API_KEY", "");
  }

  get openAiModel(): string {
    return this.configService.get<string>("OPENAI_MODEL", "gpt-4o");
  }

  get openRouterApiKey(): string {
    return this.configService.get<string>("OPENROUTER_API_KEY", "");
  }

  get openRouterModel(): string {
    return this.configService.get<string>("OPENROUTER_MODEL", "openai/gpt-4.1");
  }

  get openRouterBaseUrl(): string {
    return this.configService.get<string>(
      "OPENROUTER_BASE_URL",
      "https://openrouter.ai/api/v1",
    );
  }

  get openRouterSiteUrl(): string {
    return this.configService.get<string>(
      "OPENROUTER_SITE_URL",
      "http://localhost:5173",
    );
  }

  get openRouterAppName(): string {
    return this.configService.get<string>("OPENROUTER_APP_NAME", "DocFlow");
  }

  get anthropicApiKey(): string {
    return this.configService.get<string>("ANTHROPIC_API_KEY", "");
  }

  get anthropicModel(): string {
    return this.configService.get<string>(
      "ANTHROPIC_MODEL",
      "claude-sonnet-4-20250514",
    );
  }

  get port(): number {
    return parseInt(this.configService.get<string>("PORT", "3001"), 10);
  }

  get corsOrigin(): string {
    return this.configService.get<string>(
      "CORS_ORIGIN",
      "http://localhost:5173",
    );
  }

  get supabaseStorageBucket(): string {
    return this.configService.get<string>(
      "SUPABASE_STORAGE_BUCKET",
      "recording-screenshots",
    );
  }

  get supabaseStorageSignedUrlTtlSeconds(): number {
    return parseInt(
      this.configService.get<string>(
        "SUPABASE_STORAGE_SIGNED_URL_TTL_SECONDS",
        "604800",
      ),
      10,
    );
  }

  get supabaseEdgeFunctionUrl(): string {
    return this.configService.get<string>("SUPABASE_EDGE_FUNCTION_URL", "");
  }

  get resendApiKey(): string {
    return this.configService.get<string>("RESEND_API_KEY", "");
  }
}
