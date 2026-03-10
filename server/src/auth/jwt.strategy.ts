import { Injectable, UnauthorizedException } from '@nestjs/common';
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
        const issuer = readUnverifiedIssuer(rawToken);
        if (issuer === config.logtoIssuer) {
          if (logtoSecretProvider) {
            return logtoSecretProvider(req, rawToken, done);
          }
          return done(new UnauthorizedException('Logto authentication is not configured.'));
        }
        done(null, config.jwtAccessTokenSecret);
      },
      passReqToCallback: true,
      issuer: undefined,
      audience: undefined,
      algorithms: ['HS256', 'RS256'],
    });

    this.logtoJwks = config.logtoJwksUri
      ? createRemoteJWKSet(new URL(config.logtoJwksUri))
      : null;
    this.logtoSecretProvider = config.logtoJwksUri
      ? logtoSecretProvider
      : null;
  }

  async validate(req: { headers?: { authorization?: string } }, payload: StrategyPayload): Promise<UserContext> {
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

    const email = this.extractClaim(verified, ['email', 'username']) || `${subject}@logto.local`;
    const displayName =
      this.extractClaim(verified, ['name', 'username', 'email']) || email.split('@')[0] || 'DocFlow User';
    const user = await this.authService.resolveLogtoUser({
      subject,
      email,
      displayName,
    });

    return this.authService.buildUserContext(user);
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

    try {
      const { payload } = await jwtVerify(token, this.logtoJwks, {
        issuer: this.config.logtoIssuer,
        audience: this.config.logtoApiResource || undefined,
      });
      return payload as StrategyPayload;
    } catch {
      throw new UnauthorizedException('Invalid Logto access token.');
    }
  }

  private extractClaim(payload: StrategyPayload, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return undefined;
  }
}

function readUnverifiedIssuer(token: string): string | undefined {
  const parts = token.split('.');
  if (parts.length < 2) return undefined;
  try {
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson) as { iss?: string };
    return typeof payload.iss === 'string' ? payload.iss : undefined;
  } catch {
    return undefined;
  }
}
