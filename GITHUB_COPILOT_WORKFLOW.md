# GitHub Copilot-Style Workflow

This document describes the GitHub Copilot-style workflow implemented in this Claude Code Action.

## Overview

When a specific label is assigned to an issue, the action provides immediate feedback and creates a pull request for Claude to work in, similar to how GitHub Copilot operates.

## Workflow Steps

### Phase 1: Quick Response (~10-30 seconds)

When a label is assigned to an issue:

1. **👀 Eyes Reaction**: Immediately adds an "eyes" emoji reaction to the issue to indicate Claude has noticed the task
2. **🌿 Branch Creation**: Creates a new branch from the base branch (e.g., `claude/issue-123-20241229_143022`)
3. **📝 Initial Commit**: Creates an empty commit to initialize the branch with proper attribution
4. **🔄 Pull Request**: Creates a pull request that references the original issue
5. **⚙️ Context Setup**: Prepares environment variables for the main Claude process

### Phase 2: Full Processing (background)

The main Claude Code process then:

1. **💬 Comments in PR**: All Claude's progress updates and results are posted in the pull request (not the original issue)
2. **🔧 Code Changes**: Claude makes commits to the branch as it works
3. **📊 Final Results**: Updates the PR with completion status

## Configuration

To enable this workflow, use the `label_trigger` input in your GitHub Action:

```yaml
- uses: anthropics/claude-code-action@main
  with:
    label_trigger: "claude" # Label name that triggers the workflow
    # ... other inputs
```

## Key Features

- **Fast Feedback**: Users see immediate response (eyes emoji + PR creation) within seconds
- **Organized Discussion**: All work discussion happens in the dedicated PR
- **Clear Attribution**: Empty initial commit shows Claude's involvement
- **Issue Linking**: PR automatically references and can close the original issue
- **Parallel Processing**: Quick response doesn't block the main Claude analysis

## Example Usage

1. User creates an issue: "Add user authentication"
2. User assigns the `claude` label to the issue
3. **Within 30 seconds**: Claude adds 👀 reaction and creates PR #124
4. **In background**: Claude analyzes requirements and starts implementation
5. All progress updates appear in PR #124 comments
6. When complete, PR #124 can be merged to close the original issue

## Available MCP Tools

The action now includes additional MCP tools for GitHub operations:

- `mcp__github_file_ops__create_pull_request`: Create new pull requests
- `mcp__github_file_ops__add_reaction`: Add emoji reactions to issues/comments
- `mcp__github_file_ops__commit_files`: Commit code changes
- `mcp__github_file_ops__delete_files`: Delete files
- `mcp__github_file_ops__update_claude_comment`: Update progress comments

## Environment Variables

The following environment variables are set during the workflow:

- `CLAUDE_USE_PR_COMMENTS=true`: Directs comments to the PR instead of the issue
- `CLAUDE_PR_NUMBER`: The PR number created for this issue
- `CLAUDE_BRANCH`: The branch name created for this issue
- `BASE_BRANCH`: The base branch used for the PR

## Benefits

1. **User Experience**: Immediate feedback that Claude is working
2. **Organization**: Clean separation between issue discussion and implementation work
3. **Transparency**: All work is visible and reviewable in the PR
4. **Efficiency**: Fast initial response while complex processing happens in background
5. **Integration**: Seamless with existing GitHub workflows and permissions
