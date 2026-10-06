---
name: issue-read-github
description: >
  Retrieves and reads issues from GitHub issue trackers using gh CLI.
  Use when working with GitHub issues, or when the user mentions reading,
  viewing, or retrieving issues from GitHub.
version: '1.0.0'
---

# GitHub Issue Retrieval

This skill guides you through retrieving and reading GitHub issues using the gh CLI tool.

## Prerequisites

- gh CLI installed and authenticated
- Access to the target repository

## Basic Commands

### List Issues

```bash
# List all open issues
gh issue list

# List issues with specific state
gh issue list --state closed
gh issue list --state all

# Filter by label
gh issue list --label bug
gh issue list --label "high priority"

# Filter by assignee
gh issue list --assignee @me
gh issue list --assignee username

# Limit results
gh issue list --limit 50
```

### View Single Issue

```bash
# View issue by number
gh issue view 123

# View with comments
gh issue view 123 --comments

# Output as JSON for parsing
gh issue view 123 --json title,body,labels,assignees,state
```

### Cross-Repository Access

When the issue is in a different repository:

```bash
gh issue list --repo owner/repo
gh issue view 123 --repo owner/repo
```

## Best Practices

1. **Check comments**: Issue descriptions may be incomplete. Always review comments for updates.
2. **Review linked PRs**: Check for linked pull requests that may have addressed the issue.
3. **Verify state**: Confirm the issue is still open before starting work.
4. **Check labels**: Labels indicate priority, type, and status.
5. **Review milestones**: Milestones indicate release targets.

## Common Patterns

### Get Issue Details for Implementation

```bash
# Get full context for implementation
gh issue view 123 --json title,body,labels,comments,milestone
```

### Find Related Issues

```bash
# Search for related issues
gh issue list --search "keyword in:title,body"
```

## Placeholders

- `{{issue_id}}` - The issue number
- `{{issue_tracker_repo_slug}}` - The repository (owner/repo format)
- `{{issue_tracker_repo_owner}}` - The repository owner
- `{{issue_tracker_repo_name}}` - The repository name
