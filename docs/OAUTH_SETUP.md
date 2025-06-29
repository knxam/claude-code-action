# Claude OAuth Setup

This document explains how to configure OAuth authentication for Claude Code Action.

## Overview

The action supports OAuth authentication for Claude, which allows for automatic token management and renewal. This is useful for long-running workflows and ensures continuous authentication without manual intervention.

## Configuration

### 1. Basic OAuth Setup

Add the following inputs to your workflow:

```yaml
- uses: knxam/claude-code-action@main
  with:
    claude_access_token: ${{ secrets.CLAUDE_ACCESS_TOKEN }}
    claude_refresh_token: ${{ secrets.CLAUDE_REFRESH_TOKEN }}
    claude_expires_at: ${{ secrets.CLAUDE_EXPIRES_AT }}
    # ... other inputs
```

### 2. Advanced Setup with Automatic Secret Updates

For automatic token renewal and GitHub secret updates:

```yaml
- uses: knxam/claude-code-action@main
  with:
    claude_access_token: ${{ secrets.CLAUDE_ACCESS_TOKEN }}
    claude_refresh_token: ${{ secrets.CLAUDE_REFRESH_TOKEN }}
    claude_expires_at: ${{ secrets.CLAUDE_EXPIRES_AT }}
    github_pat: ${{ secrets.GITHUB_PAT }}
    # ... other inputs
```

## Required Secrets

### GitHub Repository Secrets

Set up the following secrets in your GitHub repository:

1. **`CLAUDE_ACCESS_TOKEN`** - Your Claude OAuth access token
2. **`CLAUDE_REFRESH_TOKEN`** - Your Claude OAuth refresh token
3. **`CLAUDE_EXPIRES_AT`** - Token expiration timestamp (Unix timestamp in milliseconds)
4. **`GITHUB_PAT`** (optional) - GitHub Personal Access Token with `admin:repo_hook` permissions

### Obtaining Claude OAuth Tokens

1. Visit the Claude OAuth authorization page
2. Authorize the application
3. Copy the access token, refresh token, and expiration timestamp
4. Add them to your GitHub repository secrets

**Note**: The `claude_expires_at` should be a Unix timestamp in milliseconds. You can calculate this from the `expires_in` value returned by the OAuth API:

```javascript
const expiresAt = Date.now() + expiresIn * 1000;
```

## How It Works

### Authentication Flow

1. **Setup Phase**: The action runs the Claude authentication setup before any other operations
2. **Settings Configuration**: Creates `~/.claude/settings.json` with required settings
3. **Credentials Storage**: Saves OAuth tokens to `~/.claude/.credentials.json`
4. **Token Refresh**: Automatically refreshes tokens if they're near expiration
5. **Secret Updates**: Optionally updates GitHub secrets with new tokens

### File Locations

- **Settings**: `$XDG_CONFIG_HOME/claude/settings.json` or `~/.claude/settings.json`
- **Credentials**: `$XDG_CONFIG_HOME/claude/.credentials.json` or `~/.claude/.credentials.json`

### Settings Configuration

The action automatically configures:

```json
{
  "enableAllProjectMcpServers": true
}
```

### Credentials Format

```json
{
  "access_token": "your-access-token",
  "refresh_token": "your-refresh-token",
  "expires_at": 1234567890000
}
```

## Security Considerations

1. **Token Storage**: Tokens are stored in the container's filesystem and are not persisted
2. **Automatic Refresh**: Tokens are refreshed automatically when near expiration (60-minute buffer)
3. **Secret Updates**: If a GitHub PAT is provided, new tokens are automatically stored in repository secrets
4. **Permissions**: GitHub PAT requires `admin:repo_hook` permissions for secret updates

## Troubleshooting

### Common Issues

1. **Token Expired**: If tokens are expired, the action will attempt to refresh them
2. **Invalid Refresh Token**: Check that your refresh token is valid and not expired
3. **Missing Permissions**: Ensure GitHub PAT has correct permissions for secret updates

### Debug Logs

The action provides detailed logging:

```
🚀 Setting up Claude authentication...
📁 Setting up Claude config directory: /home/runner/.claude
✅ Created config directory: /home/runner/.claude
✅ Claude settings configured at: /home/runner/.claude/settings.json
🔐 Setting up OAuth credentials...
🔄 Token was refreshed preemptively
✅ OAuth credentials saved to: /home/runner/.claude/.credentials.json
✅ Claude authentication setup completed successfully
```

### Error Messages

- `❌ Failed to refresh token`: Check that refresh token is valid
- `⚠️ Failed to update GitHub secrets`: Check GitHub PAT permissions
- `⚠️ No OAuth credentials provided`: OAuth parameters not set (this is normal if not using OAuth)

## Alternative Authentication

If OAuth is not configured, the action will fall back to other authentication methods:

1. `anthropic_api_key` input parameter
2. `ANTHROPIC_API_KEY` environment variable
3. AWS Bedrock authentication (if `use_bedrock: true`)
4. Google Vertex AI authentication (if `use_vertex: true`)

## Example Workflow

```yaml
name: Claude Code Action with OAuth

on:
  issues:
    types: [labeled]

jobs:
  claude:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: knxam/claude-code-action@main
        with:
          label_trigger: "claude"
          claude_access_token: ${{ secrets.CLAUDE_ACCESS_TOKEN }}
          claude_refresh_token: ${{ secrets.CLAUDE_REFRESH_TOKEN }}
          claude_expires_at: ${{ secrets.CLAUDE_EXPIRES_AT }}
          github_pat: ${{ secrets.GITHUB_PAT }}
```

This setup ensures that Claude has proper authentication and can work continuously without manual token management.
