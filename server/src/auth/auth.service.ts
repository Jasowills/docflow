import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { sign, verify, type Secret, type SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { UserContext, WorkspaceSummary } from '@docflow/shared';
import { AppConfig } from '../config/app-config';
import type { AuthUserRecord } from './auth.types';
import { UsersRepository } from './users.repository';
import { hashPassword, verifyPassword } from './password.util';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import { WorkspacesRepository } from './workspaces.repository';

interface RefreshTokenClaims {
  sub: string;
  email: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly workspacesRepository: WorkspacesRepository,
    private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      throw new BadRequestException('An account with this email already exists.');
    }

    if (dto.accountType === 'team' && !dto.teamName?.trim()) {
      throw new BadRequestException('Team name is required for team accounts.');
    }

    const now = new Date().toISOString();
    const userId = uuidv4();
    const workspaceId = uuidv4();
    const workspaceName =
      dto.accountType === 'team'
        ? dto.teamName!.trim()
        : `${dto.displayName.trim()}'s Workspace`;
    const user: AuthUserRecord = {
      userId,
      email,
      displayName: dto.displayName.trim(),
      passwordHash: hashPassword(dto.password),
      accountType: dto.accountType,
      teamName: dto.teamName?.trim() || undefined,
      defaultWorkspaceId: workspaceId,
      roles: dto.accountType === 'team' ? ['owner'] : ['member'],
      createdAtUtc: now,
      lastLoginAtUtc: now,
    };

    await this.usersRepository.insert(user);
    const workspace = await this.workspacesRepository.createDefaultWorkspace({
      workspaceId,
      ownerUserId: userId,
      ownerEmail: email,
      ownerDisplayName: user.displayName,
      accountType: dto.accountType,
      workspaceName,
    });
    return this.buildAuthResponse(user, workspace);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepository.findByEmail(email);
    if (!user || !user.passwordHash || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const now = new Date().toISOString();
    await this.usersRepository.updateLastLogin(user.userId, now);

    return this.buildAuthResponse({
      ...user,
      lastLoginAtUtc: now,
    });
  }

  async refresh(refreshToken: string) {
    const claims = this.verifyRefreshToken(refreshToken);
    const user = await this.usersRepository.findByUserId(claims.sub);
    if (!user || user.email !== claims.email) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const workspace = await this.resolveWorkspace(user);
    const roles = await this.resolveWorkspaceRoles(user);

    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      roles,
      accountType: user.accountType,
      teamName: user.teamName,
      workspaceId: workspace?.workspaceId,
      workspaceName: workspace?.name,
    };
  }

  async resolveLogtoUser(params: {
    subject: string;
    email: string;
    displayName: string;
  }): Promise<AuthUserRecord> {
    const normalizedEmail = params.email.trim().toLowerCase();
    let user = await this.usersRepository.findByExternalIdentity('logto', params.subject);

    if (!user) {
      user = await this.usersRepository.findByEmail(normalizedEmail);
      if (user) {
        await this.usersRepository.linkExternalIdentity(user.userId, 'logto', params.subject);
        user = {
          ...user,
          externalProvider: 'logto',
          externalSubject: params.subject,
        };
      }
    }

    if (!user) {
      const now = new Date().toISOString();
      const userId = uuidv4();
      const workspaceId = uuidv4();
      const displayName = params.displayName.trim() || normalizedEmail.split('@')[0];
      const createdUser: AuthUserRecord = {
        userId,
        email: normalizedEmail,
        displayName,
        externalProvider: 'logto',
        externalSubject: params.subject,
        accountType: 'individual',
        defaultWorkspaceId: workspaceId,
        roles: ['member'],
        createdAtUtc: now,
        lastLoginAtUtc: now,
      };

      await this.usersRepository.insert(createdUser);
      await this.workspacesRepository.createDefaultWorkspace({
        workspaceId,
        ownerUserId: userId,
        ownerEmail: normalizedEmail,
        ownerDisplayName: displayName,
        accountType: 'individual',
        workspaceName: `${displayName}'s Workspace`,
      });
      return createdUser;
    }

    const now = new Date().toISOString();
    await this.usersRepository.updateLastLogin(user.userId, now);
    return {
      ...user,
      lastLoginAtUtc: now,
    };
  }

  async buildUserContext(user: AuthUserRecord): Promise<UserContext> {
    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      roles: await this.resolveWorkspaceRoles(user),
      workspaceId: user.defaultWorkspaceId,
    };
  }

  private async buildAuthResponse(
    user: AuthUserRecord,
    workspaceOverride?: WorkspaceSummary | null,
  ) {
    const workspace = workspaceOverride ?? (await this.resolveWorkspace(user));
    const roles = await this.resolveWorkspaceRoles(user);
    const accessTokenOptions: SignOptions = {
      algorithm: 'HS256',
      expiresIn: this.config.jwtAccessTokenTtl as SignOptions['expiresIn'],
      issuer: 'docflow-api',
      audience: 'docflow-web',
      subject: user.userId,
    };

    const accessToken = sign(
      {
        email: user.email,
        name: user.displayName,
        roles,
        accountType: user.accountType,
        teamName: user.teamName,
        workspaceId: workspace?.workspaceId,
        workspaceName: workspace?.name,
      },
      this.config.jwtAccessTokenSecret as Secret,
      accessTokenOptions,
    );

    const refreshTokenOptions: SignOptions = {
      algorithm: 'HS256',
      expiresIn: this.config.jwtRefreshTokenTtl as SignOptions['expiresIn'],
      issuer: 'docflow-api',
      audience: 'docflow-refresh',
      subject: user.userId,
    };

    const refreshToken = sign(
      {
        email: user.email,
        type: 'refresh',
      },
      this.config.jwtRefreshTokenSecret as Secret,
      refreshTokenOptions,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        roles,
        accountType: user.accountType,
        teamName: user.teamName,
        workspaceId: workspace?.workspaceId,
        workspaceName: workspace?.name,
      },
    };
  }

  private async resolveWorkspace(user: AuthUserRecord): Promise<WorkspaceSummary | null> {
    if (!user.defaultWorkspaceId) return null;
    return this.workspacesRepository.findSummaryById(user.defaultWorkspaceId);
  }

  private async resolveWorkspaceRoles(user: AuthUserRecord): Promise<string[]> {
    if (!user.defaultWorkspaceId) {
      return user.roles;
    }
    const role = await this.workspacesRepository.getMemberRole(
      user.defaultWorkspaceId,
      user.userId,
    );
    return role ? [role] : user.roles;
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenClaims {
    try {
      const decoded = verify(refreshToken, this.config.jwtRefreshTokenSecret, {
        algorithms: ['HS256'],
        issuer: 'docflow-api',
        audience: 'docflow-refresh',
      }) as RefreshTokenClaims;

      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token.');
      }

      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }
}
