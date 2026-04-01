import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { sign, verify, type Secret, type SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import type { UserContext, WorkspaceSummary } from "@docflow/shared";
import { AppConfig } from "../config/app-config";
import type { AuthUserRecord } from "./auth.types";
import { UsersRepository } from "./users.repository";
import { hashPassword, verifyPassword } from "./password.util";
import type { LoginDto, RegisterDto } from "./dto/auth.dto";
import { WorkspacesRepository } from "./workspaces.repository";

interface RefreshTokenClaims {
  sub: string;
  email: string;
  type: "refresh";
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
      throw new BadRequestException(
        "An account with this email already exists.",
      );
    }

    if (dto.accountType === "team" && !dto.teamName?.trim()) {
      throw new BadRequestException("Team name is required for team accounts.");
    }

    const now = new Date().toISOString();
    const userId = uuidv4();
    const workspaceId = uuidv4();
    const workspaceName =
      dto.accountType === "team"
        ? dto.teamName!.trim()
        : buildPersonalWorkspaceName(dto.displayName, email);
    const user: AuthUserRecord = {
      userId,
      email,
      displayName: dto.displayName.trim(),
      passwordHash: hashPassword(dto.password),
      accountType: dto.accountType,
      teamName: dto.teamName?.trim() || undefined,
      defaultWorkspaceId: workspaceId,
      roles: dto.accountType === "team" ? ["owner"] : ["member"],
      createdAtUtc: now,
      lastLoginAtUtc: now,
      onboardingState: {},
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
    if (
      !user ||
      !user.passwordHash ||
      !verifyPassword(dto.password, user.passwordHash)
    ) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const now = new Date().toISOString();
    await this.usersRepository.updateLastLogin(user.userId, now);

    return this.buildAuthResponse({
      ...user,
      lastLoginAtUtc: now,
    });
  }

  async googleAuth(code: string) {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        redirect_uri: this.config.googleCallbackUrl,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      throw new UnauthorizedException(
        `Google token exchange failed: ${errorBody}`,
      );
    }

    const tokens = (await tokenResponse.json()) as { access_token: string };

    const profileResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      },
    );

    if (!profileResponse.ok) {
      throw new UnauthorizedException("Failed to fetch Google profile.");
    }

    const profile = (await profileResponse.json()) as {
      id: string;
      email: string;
      name?: string;
      picture?: string;
    };

    if (!profile.email) {
      throw new BadRequestException(
        "Google account does not have an email address.",
      );
    }

    const googleSubject = profile.id;
    const email = profile.email.trim().toLowerCase();
    const displayName = profile.name?.trim() || email.split("@")[0];

    let user = await this.usersRepository.findByExternalIdentity(
      "google",
      googleSubject,
    );

    if (!user) {
      user = await this.usersRepository.findByEmail(email);
      if (user) {
        await this.usersRepository.linkExternalIdentity(
          user.userId,
          "google",
          googleSubject,
        );
        user = {
          ...user,
          externalProvider: "google",
          externalSubject: googleSubject,
        };
      }
    }

    if (!user) {
      const now = new Date().toISOString();
      const userId = uuidv4();
      const workspaceId = uuidv4();
      const newUser: AuthUserRecord = {
        userId,
        email,
        displayName,
        externalProvider: "google",
        externalSubject: googleSubject,
        accountType: "individual",
        defaultWorkspaceId: workspaceId,
        roles: ["member"],
        createdAtUtc: now,
        lastLoginAtUtc: now,
        onboardingState: { needsAccountSetup: true },
      };

      await this.usersRepository.insert(newUser);
      const workspace = await this.workspacesRepository.createDefaultWorkspace({
        workspaceId,
        ownerUserId: userId,
        ownerEmail: email,
        ownerDisplayName: displayName,
        accountType: "individual",
        workspaceName: buildPersonalWorkspaceName(displayName, email),
      });
      return this.buildAuthResponse(newUser, workspace);
    }

    const now = new Date().toISOString();
    await this.usersRepository.updateLastLogin(user.userId, now);
    return this.buildAuthResponse({ ...user, lastLoginAtUtc: now });
  }

  async refresh(refreshToken: string) {
    const claims = this.verifyRefreshToken(refreshToken);
    const user = await this.usersRepository.findByUserId(claims.sub);
    if (!user || user.email !== claims.email) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException("User not found.");
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
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingState: user.onboardingState || {},
    };
  }

  async updateOnboarding(
    userId: string,
    updates: {
      completed?: boolean;
      state?: Record<string, unknown>;
    },
  ) {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    const nextState = {
      ...(user.onboardingState || {}),
      ...(updates.state || {}),
    };

    await this.usersRepository.updateOnboarding(userId, {
      onboardingCompletedAt: updates.completed
        ? new Date().toISOString()
        : user.onboardingCompletedAt || null,
      onboardingState: nextState,
    });

    return this.me(userId);
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    if (user.accountType === "team") {
      throw new BadRequestException(
        "Team accounts cannot be deleted directly. Please remove workspace members first.",
      );
    }

    await this.usersRepository.delete(userId);
  }

  async updateAccountSetup(
    userId: string,
    setup: { accountType: "individual" | "team"; teamName?: string },
  ) {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    if (setup.accountType === "team" && !setup.teamName?.trim()) {
      throw new BadRequestException("Team name is required for team accounts.");
    }

    await this.usersRepository.updateAccountSetup(userId, setup);

    const workspaceName =
      setup.accountType === "team"
        ? setup.teamName!.trim()
        : buildPersonalWorkspaceName(user.displayName, user.email);

    if (user.defaultWorkspaceId) {
      await this.workspacesRepository.renameWorkspace(
        user.defaultWorkspaceId,
        workspaceName,
      );
    }

    await this.usersRepository.updateOnboarding(userId, {
      onboardingState: {
        ...(user.onboardingState || {}),
        needsAccountSetup: false,
        accountSetupCompleted: true,
      },
    });

    return this.me(userId);
  }

  async syncLogtoProfile(
    userId: string,
    profile: {
      email?: string;
      displayName?: string;
    },
  ) {
    const user = await this.usersRepository.findByUserId(userId);
    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    const nextEmail = profile.email?.trim().toLowerCase();
    const nextDisplayName = profile.displayName?.trim();
    const shouldUpdateEmail =
      !!nextEmail &&
      nextEmail !== user.email &&
      user.email.endsWith("@logto.local");
    const shouldUpdateDisplayName =
      !!nextDisplayName &&
      nextDisplayName !== user.displayName &&
      (user.email.endsWith("@logto.local") ||
        user.displayName === user.email.split("@")[0] ||
        user.displayName.trim().length === 0);

    if (shouldUpdateEmail || shouldUpdateDisplayName) {
      const resolvedEmail = shouldUpdateEmail ? nextEmail : user.email;
      const resolvedDisplayName = shouldUpdateDisplayName
        ? nextDisplayName
        : user.displayName;
      const previousDisplayName = user.displayName;

      await this.usersRepository.updateProfile(user.userId, {
        email: resolvedEmail,
        displayName: resolvedDisplayName,
        externalProvider: "logto",
        externalSubject: user.externalSubject,
      });

      if (user.defaultWorkspaceId) {
        await this.workspacesRepository.syncMemberProfile(
          user.defaultWorkspaceId,
          user.userId,
          {
            email: resolvedEmail,
            displayName: resolvedDisplayName,
          },
        );
        await this.syncDefaultWorkspaceNameIfNeeded(
          user.defaultWorkspaceId,
          user.accountType,
          previousDisplayName,
          resolvedDisplayName,
        );
      }
    }

    return this.me(userId);
  }

  async bootstrapLogtoUser(
    context: UserContext,
    profile: {
      email?: string;
      displayName?: string;
    },
  ) {
    if (context.userId) {
      if (profile.email || profile.displayName) {
        await this.syncLogtoProfile(context.userId, profile);
      }
      return this.me(context.userId);
    }

    const subject = context.externalSubject;
    if (!subject) {
      throw new UnauthorizedException("Missing Logto subject.");
    }

    const email = profile.email?.trim().toLowerCase();
    const displayName = profile.displayName?.trim() || email || subject;

    if (!email) {
      throw new BadRequestException(
        "Logto profile is missing an email address. Ensure the application requests the email scope and the user has an email in Logto.",
      );
    }

    const user = await this.resolveLogtoUser({
      subject,
      email,
      displayName,
    });

    return this.me(user.userId);
  }

  async findLogtoUserContext(subject: string): Promise<UserContext | null> {
    const user = await this.usersRepository.findByExternalIdentity(
      "logto",
      subject,
    );
    if (!user) return null;
    return this.buildUserContext(user);
  }

  async resolveLogtoUser(params: {
    subject: string;
    email: string;
    displayName: string;
  }): Promise<AuthUserRecord> {
    const normalizedEmail = params.email.trim().toLowerCase();
    let user = await this.usersRepository.findByExternalIdentity(
      "logto",
      params.subject,
    );

    if (!user) {
      user = await this.usersRepository.findByEmail(normalizedEmail);
      if (user) {
        await this.usersRepository.linkExternalIdentity(
          user.userId,
          "logto",
          params.subject,
        );
        user = {
          ...user,
          externalProvider: "logto",
          externalSubject: params.subject,
        };
      }
    }

    if (!user) {
      const now = new Date().toISOString();
      const userId = uuidv4();
      const workspaceId = uuidv4();
      const displayName =
        params.displayName.trim() || normalizedEmail.split("@")[0];
      const createdUser: AuthUserRecord = {
        userId,
        email: normalizedEmail,
        displayName,
        externalProvider: "logto",
        externalSubject: params.subject,
        accountType: "individual",
        defaultWorkspaceId: workspaceId,
        roles: ["member"],
        createdAtUtc: now,
        lastLoginAtUtc: now,
        onboardingState: {},
      };

      await this.usersRepository.insert(createdUser);
      await this.workspacesRepository.createDefaultWorkspace({
        workspaceId,
        ownerUserId: userId,
        ownerEmail: normalizedEmail,
        ownerDisplayName: displayName,
        accountType: "individual",
        workspaceName: buildPersonalWorkspaceName(displayName, normalizedEmail),
      });
      return createdUser;
    }

    const shouldUpdateFallbackEmail =
      normalizedEmail &&
      normalizedEmail !== user.email &&
      user.email.endsWith("@logto.local");
    const shouldUpdateDisplayName =
      params.displayName.trim() &&
      params.displayName.trim() !== user.displayName &&
      (user.displayName === user.email.split("@")[0] ||
        user.displayName === params.subject ||
        user.email.endsWith("@logto.local"));

    if (shouldUpdateFallbackEmail || shouldUpdateDisplayName) {
      const nextEmail = shouldUpdateFallbackEmail
        ? normalizedEmail
        : user.email;
      const nextDisplayName = shouldUpdateDisplayName
        ? params.displayName.trim()
        : user.displayName;
      const previousDisplayName = user.displayName;

      await this.usersRepository.updateProfile(user.userId, {
        email: nextEmail,
        displayName: nextDisplayName,
        externalProvider: "logto",
        externalSubject: params.subject,
      });

      if (user.defaultWorkspaceId) {
        await this.workspacesRepository.syncMemberProfile(
          user.defaultWorkspaceId,
          user.userId,
          {
            email: nextEmail,
            displayName: nextDisplayName,
          },
        );
        await this.syncDefaultWorkspaceNameIfNeeded(
          user.defaultWorkspaceId,
          user.accountType,
          previousDisplayName,
          nextDisplayName,
        );
      }

      user = {
        ...user,
        email: nextEmail,
        displayName: nextDisplayName,
        externalProvider: "logto",
        externalSubject: params.subject,
      };
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
      authProvider: user.externalProvider === "logto" ? "logto" : "jwt",
      externalSubject: user.externalSubject,
      provisioned: true,
    };
  }

  private async buildAuthResponse(
    user: AuthUserRecord,
    workspaceOverride?: WorkspaceSummary | null,
  ) {
    const workspace = workspaceOverride ?? (await this.resolveWorkspace(user));
    const roles = await this.resolveWorkspaceRoles(user);
    const accessTokenOptions: SignOptions = {
      algorithm: "HS256",
      expiresIn: this.config.jwtAccessTokenTtl as SignOptions["expiresIn"],
      issuer: "docflow-api",
      audience: "docflow-web",
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
      algorithm: "HS256",
      expiresIn: this.config.jwtRefreshTokenTtl as SignOptions["expiresIn"],
      issuer: "docflow-api",
      audience: "docflow-refresh",
      subject: user.userId,
    };

    const refreshToken = sign(
      {
        email: user.email,
        type: "refresh",
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
        onboardingCompletedAt: user.onboardingCompletedAt,
        onboardingState: user.onboardingState || {},
      },
    };
  }

  private async resolveWorkspace(
    user: AuthUserRecord,
  ): Promise<WorkspaceSummary | null> {
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

  private async syncDefaultWorkspaceNameIfNeeded(
    workspaceId: string,
    accountType: AuthUserRecord["accountType"],
    previousDisplayName: string,
    nextDisplayName: string,
  ): Promise<void> {
    if (accountType !== "individual") {
      return;
    }

    const workspace =
      await this.workspacesRepository.findSummaryById(workspaceId);
    if (!workspace) {
      return;
    }

    const expectedPreviousName =
      buildPersonalWorkspaceName(previousDisplayName);
    const expectedNextName = buildPersonalWorkspaceName(nextDisplayName);
    if (
      workspace.name !== expectedPreviousName ||
      workspace.name === expectedNextName
    ) {
      return;
    }

    await this.workspacesRepository.renameWorkspace(
      workspaceId,
      expectedNextName,
    );
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenClaims {
    try {
      const decoded = verify(refreshToken, this.config.jwtRefreshTokenSecret, {
        algorithms: ["HS256"],
        issuer: "docflow-api",
        audience: "docflow-refresh",
      }) as RefreshTokenClaims;

      if (decoded.type !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token.");
      }

      return decoded;
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
  }
}

function buildPersonalWorkspaceName(
  displayName?: string,
  email?: string,
): string {
  const preferredName =
    getHumanFriendlyName(displayName) ||
    getHumanFriendlyName(email?.split("@")[0]) ||
    "My";

  return `${preferredName}'s Workspace`;
}

function getHumanFriendlyName(value?: string): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  if (looksOpaqueIdentifier(normalized)) {
    return undefined;
  }

  const cleaned = normalized
    .replace(/@.*$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return undefined;
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function looksOpaqueIdentifier(value: string): boolean {
  return (
    value.length >= 8 &&
    !/\s/.test(value) &&
    /[a-z]/i.test(value) &&
    /\d/.test(value)
  );
}
