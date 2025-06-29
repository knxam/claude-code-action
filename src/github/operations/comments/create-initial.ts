#!/usr/bin/env bun

/**
 * Create the initial tracking comment when Claude Code starts working
 * This comment shows the working status and includes a link to the job run
 */

import { appendFileSync } from "fs";
import { createJobRunLink, createCommentBody } from "./common";
import {
  isPullRequestReviewCommentEvent,
  type ParsedGitHubContext,
} from "../../context";
import type { Octokit } from "@octokit/rest";

export async function createInitialComment(
  octokit: Octokit,
  context: ParsedGitHubContext,
) {
  const { owner, repo } = context.repository;

  // Check if we should comment in PR instead of original issue
  const usePrComments = process.env.CLAUDE_USE_PR_COMMENTS === "true";
  const prNumber = process.env.CLAUDE_PR_NUMBER;

  let targetNumber = context.entityNumber;
  let commentLocation = "issue";

  if (usePrComments && prNumber) {
    targetNumber = parseInt(prNumber, 10);
    commentLocation = "PR";
    console.log(
      `🔄 Redirecting comment from issue #${context.entityNumber} to PR #${targetNumber}`,
    );
  }

  const jobRunLink = createJobRunLink(owner, repo, context.runId);
  const initialBody = createCommentBody(jobRunLink);

  try {
    let response;

    // Only use createReplyForReviewComment if it's a PR review comment AND we have a comment_id
    if (isPullRequestReviewCommentEvent(context) && !usePrComments) {
      response = await octokit.rest.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: context.entityNumber,
        comment_id: context.payload.comment.id,
        body: initialBody,
      });
    } else {
      // For all other cases (issues, issue comments, or PR comments)
      // Note: GitHub treats PR comments as issue comments in the API
      response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: targetNumber,
        body: initialBody,
      });
    }

    // Output the comment ID for downstream steps using GITHUB_OUTPUT
    const githubOutput = process.env.GITHUB_OUTPUT!;
    appendFileSync(githubOutput, `claude_comment_id=${response.data.id}\n`);
    console.log(
      `✅ Created initial comment with ID: ${response.data.id} in ${commentLocation} #${targetNumber}`,
    );
    return response.data.id;
  } catch (error) {
    console.error("Error in initial comment:", error);

    // Always fall back to regular issue comment if anything fails
    try {
      const fallbackTarget =
        usePrComments && prNumber
          ? parseInt(prNumber, 10)
          : context.entityNumber;
      const response = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: fallbackTarget,
        body: initialBody,
      });

      const githubOutput = process.env.GITHUB_OUTPUT!;
      appendFileSync(githubOutput, `claude_comment_id=${response.data.id}\n`);
      console.log(
        `✅ Created fallback comment with ID: ${response.data.id} in ${usePrComments ? "PR" : "issue"} #${fallbackTarget}`,
      );
      return response.data.id;
    } catch (fallbackError) {
      console.error("Error creating fallback comment:", fallbackError);
      throw fallbackError;
    }
  }
}
