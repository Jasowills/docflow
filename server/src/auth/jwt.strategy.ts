import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import type { UserContext } from '@docflow/shared';
import { AppConfig } from '../config/app-config';
import { AuthService } from './auth.service';

type StrategyPayload = Record<string, unknown> & JWTPayload;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly logtoJwks: ReturnType<typeof createRemoteJWKSet> | null;
  private readonly logtoSecretProvider:
    | ReturnType<typeof passportJwtSecret>
    | null;

  constructor(
    private readonly config: AppConfig,
    private readonly authService: AuthService,
  ) {
    const logtoSecretProvider = config.logtoJwksUri
      ? passportJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: config.logtoJwksUri,
        })
      : null;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: (
        req: unknown,
        rawToken: string,
        done: (error: Error | null, secret?: string | Buffer) => void,
      ) => {
        const header = readUnverifiedHeader(rawToken);
        const issuer = readUnverifiedIssuer(rawToken);
        this.logger.log(
          `Evaluating bearer token. alg=${String(header?.alg || '')} typ=${String(
            header?.typ || '',
          )} iss=${String(issuer || '')}`,
        );
        if (issuer === config.logtoIssuer) {
          if (logtoSecretProvider) {
            this.logger.log('Using Logto JWKS secret provider for bearer token.');
            return logtoSecretProvider(req, rawToken, done);
          }
          return done(new UnauthorizedException('Logto authentication is not configured.'));
        }
        this.logger.log('Using DocFlow JWT secret for bearer token.');
        done(null, config.jwtAccessTokenSecret);
      },
      passReqToCallback: true,
      issuer: undefined,
      audience: undefined,
      algorithms: ['HS256', 'RS256', 'ES256', 'ES384', 'ES512'],
    });

    this.logtoJwks = config.logtoJwksUri
      ? createRemoteJWKSet(new URL(config.logtoJwksUri))
      : null;
    this.logtoSecretProvider = config.logtoJwksUri
      ? logtoSecretProvider
      : null;
  }

  async validate(
    req: { headers?: { authorization?: string }; method?: string; url?: string },
    payload: StrategyPayload,
  ): Promise<UserContext> {
    this.logger.log(`Validated bearer token for ${req.method || 'UNKNOWN'} ${req.url || ''}`);
    if (this.isDocFlowToken(payload)) {
      return {
        userId: (payload.sub as string) || '',
        email: (payload.email as string) || '',
        displayName: (payload.name as string) || '',
        roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
        workspaceId: (payload.workspaceId as string) || undefined,
      };
    }

    if (this.config.authProvider !== 'logto') {
      throw new UnauthorizedException('Invalid access token.');
    }

    const rawToken = this.extractBearerToken(req);
    if (!rawToken) {
      throw new UnauthorizedException('Missing access token.');
    }

    const verified = await this.verifyLogtoToken(rawToken);
    const subject = verified.sub;
    if (!subject) {
      throw new UnauthorizedException('Invalid access token subject.');
    }
    const existing = await this.authService.findLogtoUserContext(subject);
    if (existing) {
      return existing;
    }

    return {
      userId: '',
      email: '',
      displayName: '',
      roles: [],
      workspaceId: undefined,
      authProvider: 'logto',
      externalSubject: subject,
      provisioned: false,
    };
  }

  private isDocFlowToken(payload: StrategyPayload): boolean {
    return payload.iss === 'docflow-api' && payload.aud === 'docflow-web';
  }

  private extractBearerToken(req: { headers?: { authorization?: string } }): string | null {
    const header = req.headers?.authorization || '';
    return header.startsWith('Bearer ') ? header.slice(7) : null;
  }

  private async verifyLogtoToken(token: string): Promise<StrategyPayload> {
    if (!this.logtoJwks || !this.config.logtoIssuer) {
      throw new UnauthorizedException('Logto authentication is not configured.');
    }

    const candidateAudiences = [
      this.config.logtoApiResource || undefined,
      this.config.logtoAppId || undefined,
      undefined,
    ];

    try {
      let lastError: unknown = null;
      for (const audience of candidateAudiences) {
        try {
          const { payload } = await retryAsync(() =>
            jwtVerify(token, this.logtoJwks!, {
              issuer: this.config.logtoIssuer,
              audience,
            }),
          );
          return payload as StrategyPayload;
        } catch (error) {
          lastError = error;
        }
      }

      const unverified = readUnverifiedPayload(token);
      this.logger.warn(
        `Logto token rejected. issuer=${String(unverified?.iss || '')} aud=${JSON.stringify(
          unverified?.aud || null,
        )} azp=${String(unverified?.azp || '')} expectedResource=${this.config.logtoApiResource} expectedAppId=${this.config.logtoAppId} reason=${
          lastError instanceof Error ? lastError.message : 'unknown'
        }`,
      );
      throw new UnauthorizedException('Invalid Logto access token.');
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Logto access token.');
    }
  }
}

async function retryAsync<T>(
  operation: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const delayMs = options.delayMs ?? 700;

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableNetworkError(error) || attempt === retries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
}

function isRetryableNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  const cause = error && typeof error === 'object' ? (error as { cause?: unknown }).cause : null;
  const code =
    cause && typeof cause === 'object'
      ? (cause as { code?: string }).code
      : undefined;

  return (
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    message.includes('fetch failed') ||
    message.includes('eai_again')
  );
}

function readUnverifiedIssuer(token: string): string | undefined {
  const payload = readUnverifiedPayload(token);
  return typeof payload?.iss === 'string' ? payload.iss : undefined;
}

function readUnverifiedHeader(
  token: string,
): { alg?: string; typ?: string; kid?: string } | null {
  const parts = token.split('.');
  if (parts.length < 1) return null;
  try {
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    return JSON.parse(headerJson) as { alg?: string; typ?: string; kid?: string };
  } catch {
    return null;
  }
}

function readUnverifiedPayload(
  token: string,
): { iss?: string; aud?: string | string[]; azp?: string } | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payloadJson) as { iss?: string; aud?: string | string[]; azp?: string };
  } catch {
    return null;
  }
}
