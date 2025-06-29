#!/usr/bin/env bun

/**
 * Claude OAuth and configuration management
 * Handles OAuth token management and Claude Code settings setup
 */

import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

interface ClaudeCredentials {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface ClaudeSettings {
  enableAllProjectMcpServers?: boolean;
  [key: string]: any;
}

const OAUTH_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

/**
 * Get Claude configuration directory
 */
export function getClaudeConfigDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return join(xdgConfigHome, "claude");
  }
  return join(homedir(), ".claude");
}

/**
 * Setup Claude Code settings
 */
export async function setupClaudeCodeSettings(): Promise<void> {
  const configDir = getClaudeConfigDir();
  const settingsPath = join(configDir, "settings.json");

  console.log(`📁 Setting up Claude config directory: ${configDir}`);

  // Create config directory if it doesn't exist
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
    console.log(`✅ Created config directory: ${configDir}`);
  }

  // Read existing settings or create new ones
  let settings: ClaudeSettings = {};
  if (existsSync(settingsPath)) {
    try {
      const existingSettings = await Bun.file(settingsPath).text();
      settings = JSON.parse(existingSettings);
      console.log("📖 Loaded existing Claude settings");
    } catch (error) {
      console.warn("⚠️ Failed to parse existing settings, creating new ones");
    }
  }

  // Enable all project MCP servers
  settings.enableAllProjectMcpServers = true;

  // Write settings
  await Bun.write(settingsPath, JSON.stringify(settings, null, 2));
  console.log(`✅ Claude settings configured at: ${settingsPath}`);
}

/**
 * Check if token is near expiration (within 60 minutes)
 */
function isTokenNearExpiration(expiresAt: number): boolean {
  const bufferTime = 60 * 60 * 1000; // 60 minutes in milliseconds
  return Date.now() + bufferTime >= expiresAt;
}

/**
 * Refresh OAuth token
 */
async function refreshOAuthToken(
  refreshToken: string,
): Promise<OAuthTokenResponse> {
  console.log("🔄 Refreshing OAuth token...");

  const response = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to refresh token: ${response.status} - ${errorText}`,
    );
  }

  const tokenData = (await response.json()) as OAuthTokenResponse;
  console.log("✅ OAuth token refreshed successfully");
  return tokenData;
}

/**
 * Setup OAuth credentials
 */
export async function setupOAuthCredentials(
  accessToken?: string,
  refreshToken?: string,
  expiresAtStr?: string,
  githubPat?: string,
): Promise<void> {
  if (!accessToken || !refreshToken) {
    console.log("⚠️ No OAuth credentials provided, skipping OAuth setup");
    return;
  }

  const configDir = getClaudeConfigDir();
  const credentialsPath = join(configDir, ".credentials.json");

  console.log("🔐 Setting up OAuth credentials...");

  // Create config directory if it doesn't exist
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Parse expiration time
  let expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Default 24h from now
  if (expiresAtStr) {
    const parsedExpiration = parseInt(expiresAtStr, 10);
    if (!isNaN(parsedExpiration)) {
      expiresAt = parsedExpiration;
    }
  }

  // Check if we need to refresh the token
  let finalAccessToken = accessToken;
  let finalRefreshToken = refreshToken;
  let needsRefresh = false;

  // Check if token is near expiration
  if (isTokenNearExpiration(expiresAt)) {
    console.log("⏰ Token is near expiration, attempting refresh...");
    needsRefresh = true;
  }

  if (needsRefresh) {
    try {
      const tokenResponse = await refreshOAuthToken(refreshToken);
      finalAccessToken = tokenResponse.access_token;
      finalRefreshToken = tokenResponse.refresh_token;
      expiresAt = Date.now() + tokenResponse.expires_in * 1000;
      console.log("🔄 Token was refreshed successfully");
    } catch (error) {
      console.log(
        "⚠️ Token refresh failed, using provided token as-is:",
        error instanceof Error ? error.message : String(error),
      );
      // Continue with provided tokens
    }
  } else {
    console.log("✅ Token is still valid, no refresh needed");
  }

  // Create credentials object
  const credentials: ClaudeCredentials = {
    access_token: finalAccessToken,
    refresh_token: finalRefreshToken,
    expires_at: expiresAt,
  };

  // Write credentials to file
  await Bun.write(credentialsPath, JSON.stringify(credentials, null, 2));
  console.log(`✅ OAuth credentials saved to: ${credentialsPath}`);

  // Optionally update GitHub secrets if PAT is provided
  if (githubPat && process.env.GITHUB_REPOSITORY) {
    try {
      await updateGitHubSecrets(githubPat, finalAccessToken, finalRefreshToken);
    } catch (error) {
      console.warn(
        `⚠️ Failed to update GitHub secrets: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Update GitHub repository secrets with new tokens
 */
async function updateGitHubSecrets(
  githubPat: string,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY environment variable not set");
  }

  console.log("📝 Updating GitHub repository secrets...");

  // This would require GitHub API calls to update secrets
  // For now, just log what would happen
  console.log(`🔄 Would update secrets for repository: ${repository}`);
  console.log(`   - CLAUDE_ACCESS_TOKEN (${accessToken.slice(0, 10)}...)`);
  console.log(`   - CLAUDE_REFRESH_TOKEN (${refreshToken.slice(0, 10)}...)`);
  console.log(`   - Using PAT: ${githubPat.slice(0, 10)}...`);

  // Note: Actual implementation would require GitHub API integration
  // This is a placeholder for the full implementation
}

/**
 * Main setup function for Claude authentication
 */
export async function setupClaudeAuth(params: {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  githubPat?: string;
}): Promise<void> {
  console.log("🚀 Setting up Claude authentication...");

  try {
    // Setup Claude Code settings
    await setupClaudeCodeSettings();

    // Setup OAuth credentials if provided
    await setupOAuthCredentials(
      params.accessToken,
      params.refreshToken,
      params.expiresAt,
      params.githubPat,
    );

    console.log("✅ Claude authentication setup completed successfully");
  } catch (error) {
    console.error(
      `❌ Failed to setup Claude authentication: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/**
 * CLI entrypoint when run directly
 */
async function main() {
  if (import.meta.main) {
    const accessToken = process.env.CLAUDE_ACCESS_TOKEN;
    const refreshToken = process.env.CLAUDE_REFRESH_TOKEN;
    const expiresAt = process.env.CLAUDE_EXPIRES_AT;
    const githubPat = process.env.GITHUB_PAT;

    await setupClaudeAuth({
      accessToken,
      refreshToken,
      expiresAt,
      githubPat,
    });
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("❌ Failed to setup Claude authentication:", error);
    process.exit(1);
  });
}
