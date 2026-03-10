import { Injectable, UnauthorizedException } from '@nestjs/common';
import { sign, verify, type SignOptions } from 'jsonwebtoken';
import type { UserContext } from '@docflow/shared';
import { AppConfig } from '../config/app-config';

interface ExtensionUploadTokenClaims {
  sub: string;
  email: string;
  name: string;
  type: 'extension_upload';
}

@Injectable()
export class UploadTokenService {
  constructor(private readonly config: AppConfig) {}

  createUploadToken(
    user: UserContext,
    expiresInOverrideSeconds?: number,
  ): { token: string; expiresAtUtc: string } {
    const payload: ExtensionUploadTokenClaims = {
      sub: user.userId,
      email: user.email,
      name: user.displayName || user.email,
      type: 'extension_upload',
    };

    const token = sign(payload, this.config.extensionUploadTokenSecret, {
      algorithm: 'HS256',
      expiresIn:
        (expiresInOverrideSeconds && expiresInOverrideSeconds > 0
          ? expiresInOverrideSeconds
          : this.config.extensionUploadTokenTtl) as SignOptions['expiresIn'],
      audience: 'routectrl-extension-upload',
      issuer: 'routectrl-doc-studio',
    });

    const decoded = verify(token, this.config.extensionUploadTokenSecret, {
      algorithms: ['HS256'],
      audience: 'routectrl-extension-upload',
      issuer: 'routectrl-doc-studio',
      ignoreExpiration: true,
    }) as { exp?: number };

    const expiresAtUtc = decoded.exp
      ? new Date(decoded.exp * 1000).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return { token, expiresAtUtc };
  }

  parseUploadToken(token: string): UserContext {
    try {
      const decoded = verify(token, this.config.extensionUploadTokenSecret, {
        algorithms: ['HS256'],
        audience: 'routectrl-extension-upload',
        issuer: 'routectrl-doc-studio',
      }) as ExtensionUploadTokenClaims;

      if (decoded.type !== 'extension_upload') {
        throw new UnauthorizedException('Invalid upload token type');
      }

      return {
        userId: decoded.sub,
        email: decoded.email,
        displayName: decoded.name,
        roles: [],
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired upload token');
    }
  }
}

