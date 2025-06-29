#!/usr/bin/env bun

/**
 * Quick response entrypoint for GitHub Copilot-like workflow
 * This runs immediately when a label is assigned to provide fast feedback:
 * 1. Add eyes emoji reaction to the issue
 * 2. Create a new branch from base branch
 * 3. Create an empty commit to initialize the branch
 * 4. Create a pull request from the branch
 * 5. Set environment variables for the main process to use PR for comments
 */

import * as core from "@actions/core";
import { $ } from "bun";
import { appendFileSync } from "fs";
import { setupGitHubToken } from "../github/token";
import { createOctokit } from "../github/api/client";
import { parseGitHubContext } from "../github/context";
import { checkWritePermissions } from "../github/validation/permissions";
import { checkTriggerAction } from "../github/validation/trigger";
import { checkHumanActor } from "../github/validation/actor";

async function run() {
  try {
    console.log("🚀 Starting quick response for GitHub Copilot workflow...");

    // Step 1: Setup GitHub token
    const githubToken = await setupGitHubToken();
    const octokit = createOctokit(githubToken);

    // Step 2: Parse GitHub context
    const context = parseGitHubContext();

    // Step 3: Check if this is a label trigger on an issue
    if (context.isPR) {
      console.log("This is a PR, skipping quick response");
      return;
    }

    // Step 4: Check trigger conditions
    const containsTrigger = await checkTriggerAction(context);
    if (!containsTrigger) {
      console.log("No trigger found, skipping quick response");
      return;
    }

    // Step 5: Check write permissions
    const hasWritePermissions = await checkWritePermissions(
      octokit.rest,
      context,
    );
    if (!hasWritePermissions) {
      throw new Error(
        "Actor does not have write permissions to the repository",
      );
    }

    // Step 6: Check if actor is human
    await checkHumanActor(octokit.rest, context);

    const { owner, repo } = context.repository;
    const issueNumber = context.entityNumber;
    const { baseBranch, branchPrefix } = context.inputs;

    console.log(`Processing issue #${issueNumber} in ${owner}/${repo}`);

    // Step 7: Add eyes emoji reaction to the issue
    console.log("👀 Adding eyes reaction to issue...");
    await octokit.rest.reactions.createForIssue({
      owner,
      repo,
      issue_number: issueNumber,
      content: "eyes",
    });
    console.log("✅ Eyes reaction added successfully");

    // Step 8: Get issue details for PR creation
    const issueResponse = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: issueNumber,
    });
    const issue = issueResponse.data;

    // Step 9: Determine source branch
    let sourceBranch: string;
    if (baseBranch) {
      sourceBranch = baseBranch;
    } else {
      const repoResponse = await octokit.rest.repos.get({
        owner,
        repo,
      });
      sourceBranch = repoResponse.data.default_branch;
    }

    // Step 10: Create new branch
    console.log(`🌿 Creating new branch from ${sourceBranch}...`);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:-]/g, "")
      .replace(/\.\d{3}Z$/, "")
      .split("T")
      .join("_");

    const newBranch = `${branchPrefix}issue-${issueNumber}-${timestamp}`;

    // Get the SHA of the source branch
    const sourceBranchRef = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${sourceBranch}`,
    });
    const currentSHA = sourceBranchRef.data.object.sha;

    // Create branch using GitHub API
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: currentSHA,
    });

    // Checkout the new branch
    await $`git fetch origin --depth=1 ${newBranch}`;
    await $`git checkout ${newBranch}`;

    console.log(`✅ Created and checked out branch: ${newBranch}`);

    // Step 11: Create empty commit to initialize the branch
    console.log("📝 Creating initial commit...");
    await $`git commit --allow-empty -m "chore: initialize Claude work branch for issue #${issueNumber}

This commit initializes the branch where Claude will work on resolving issue #${issueNumber}.

Co-authored-by: Claude <noreply@anthropic.com>"`;

    // Push the branch
    await $`git push origin ${newBranch}`;
    console.log("✅ Initial commit created and pushed");

    // Step 12: Create pull request
    console.log("🔄 Creating pull request...");
    const prTitle = `Claude: ${issue.title}`;
    const prBody = `Resolves #${issueNumber}

Claude is working on this issue. Progress updates will be posted here.

## Original Issue
${issue.body || "No description provided"}

---
🤖 This PR was created automatically by Claude Code Action.`;

    const prResponse = await octokit.rest.pulls.create({
      owner,
      repo,
      title: prTitle,
      head: newBranch,
      base: sourceBranch,
      body: prBody,
      draft: false,
    });

    const prNumber = prResponse.data.number;
    console.log(`✅ Pull request created: #${prNumber}`);

    // Step 13: Set environment variables for main process
    const githubOutput = process.env.GITHUB_OUTPUT!;
    appendFileSync(githubOutput, `CLAUDE_BRANCH=${newBranch}\n`);
    appendFileSync(githubOutput, `CLAUDE_PR_NUMBER=${prNumber}\n`);
    appendFileSync(githubOutput, `CLAUDE_USE_PR_COMMENTS=true\n`);
    appendFileSync(githubOutput, `BASE_BRANCH=${sourceBranch}\n`);
    appendFileSync(githubOutput, `quick_response_completed=true\n`);

    console.log("🎉 Quick response completed successfully!");
    console.log(`Branch: ${newBranch}`);
    console.log(`PR: #${prNumber}`);
    console.log("Claude will now continue with the full analysis...");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Quick response failed: ${errorMessage}`);
    core.setFailed(`Quick response failed: ${errorMessage}`);

    // Set output to indicate failure but don't exit - let main process continue
    const githubOutput = process.env.GITHUB_OUTPUT!;
    appendFileSync(githubOutput, `quick_response_completed=false\n`);
    appendFileSync(githubOutput, `quick_response_error=${errorMessage}\n`);
  }
}

if (import.meta.main) {
  run();
}
