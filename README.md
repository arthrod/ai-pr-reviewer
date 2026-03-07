# Cicero

AI-powered PR reviewer and summarizer built on Google Gemini with Google Search grounding.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Cicero is an AI-based code reviewer and summarizer for GitHub pull requests
using Google's `gemini-3.1-pro-preview` model. It runs as a GitHub Action on
every pull request and review comment, providing automated code reviews with
**Google Search grounding** for up-to-date, factually accurate responses.

## Features

- **PR Summarization**: Generates a summary and release notes of the changes
  in the pull request.
- **Line-by-line code change suggestions**: Reviews changes line by line and
  provides code change suggestions.
- **Google Search grounding**: Uses Google Search to ground responses in
  real-time web content, reducing hallucinations and improving accuracy.
- **Continuous, incremental reviews**: Reviews are performed on each commit
  within a pull request, not just a one-time review on the entire PR.
- **Cost-effective and reduced noise**: Incremental reviews save on API costs
  and reduce noise by tracking changed files between commits.
- **Chat with bot**: Reply to review comments or tag `@cicero-ai` to
  ask follow-up questions, generate test cases, or get explanations.
- **Smart review skipping**: By default, skips in-depth review for simple
  changes (e.g. typo fixes). Disable by setting `review_simple_changes` and
  `review_comment_lgtm` to `true`.
- **Customizable prompts**: Tailor the `system_message`, `summarize`, and
  `summarize_release_notes` prompts to your needs.

## Install instructions

### Adding Cicero to your repository

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Add `GEMINI_API_KEY` as a secret in your repository (Settings → Secrets and variables → Actions → New repository secret)
3. Create the file `.github/workflows/cicero.yml` in your repository:

```yaml
name: Cicero Code Review

permissions:
  contents: read
  pull-requests: write

on:
  pull_request:
  pull_request_review_comment:
    types: [created]

concurrency:
  group:
    ${{ github.repository }}-${{ github.event.number || github.head_ref ||
    github.sha }}-${{ github.workflow }}-${{ github.event_name ==
    'pull_request_review_comment' && 'pr_comment' || 'pr' }}
  cancel-in-progress: ${{ github.event_name != 'pull_request_review_comment' }}

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: arthrod/ai-pr-reviewer@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        with:
          debug: false
          review_simple_changes: false
          review_comment_lgtm: false
```

That's it. Cicero will now review every pull request automatically.

### Adding Cicero to other repositories

To add Cicero to any repository you own:

1. **Copy the workflow file** above into `.github/workflows/cicero.yml` in the target repo.
2. **Add the `GEMINI_API_KEY` secret** to the target repo (or use an organization-level secret to share across all repos).
3. **Push or open a PR** — Cicero will start reviewing automatically.

> **Tip — Organization-level secrets**: If you have multiple repos, add `GEMINI_API_KEY` as an organization secret (Organization Settings → Secrets and variables → Actions) and grant access to the repos you want. This way you only configure the key once.

> **Tip — Reusable workflow**: You can also create a [reusable workflow](https://docs.github.com/en/actions/using-workflows/reusing-workflows) in a central repo and call it from other repos to keep the configuration DRY.

### Environment variables

- `GITHUB_TOKEN`: Automatically available in GitHub Actions. Used to post
  review comments on the pull request.
- `GEMINI_API_KEY`: Your Google Gemini API key. Get one from
  [Google AI Studio](https://aistudio.google.com/apikey). Add this as a
  repository or organization secret.

Alternatively, the API key can be passed via the `gemini_api_key` action input
or loaded from `~/.env/.env` for local development.

### Model

Cicero uses `gemini-3.1-pro-preview` by default for both summary and review
tasks. This model supports:

- **1M token context window** — handles large PRs with many files
- **65K token output** — detailed reviews without truncation
- **Google Search grounding** — responses grounded in real-time web data
- **Knowledge cutoff: January 2025**

You can configure different models for light (summary) and heavy (review) tasks
using `gemini_light_model` and `gemini_heavy_model`.

### Configuration

All configuration options are in [action.yml](./action.yml). Key options:

| Input | Default | Description |
|-------|---------|-------------|
| `gemini_api_key` | `''` | Gemini API key (alternative to env var) |
| `gemini_light_model` | `gemini-3.1-pro-preview` | Model for summaries |
| `gemini_heavy_model` | `gemini-3.1-pro-preview` | Model for reviews |
| `gemini_model_temperature` | `0.05` | Temperature for generation |
| `gemini_retries` | `5` | Retry count for API errors |
| `gemini_concurrency_limit` | `6` | Concurrent Gemini API calls |
| `review_simple_changes` | `false` | Review simple changes too |
| `review_comment_lgtm` | `false` | Comment even when LGTM |
| `disable_review` | `false` | Only summarize, skip review |
| `language` | `en-US` | Response language (ISO code) |
| `system_message` | *(see action.yml)* | Custom system prompt |

### Prompts

You can customize the bot's personality via the `system_message` input. For
example, to review documentation:

```yaml
with:
  system_message: |
    You are `@cicero-ai`, a language model powered by Google Gemini.
    Your purpose is to act as a technical writer reviewing documentation
    for clarity, accuracy, and completeness.
```

## Conversation with Cicero

Reply to a review comment made by Cicero to get a follow-up response based on
the diff context. You can also tag `@cicero-ai` in any review comment to invite
the bot into the conversation.

Example:

> @cicero-ai Please generate a test plan for this file.

### Ignoring PRs

To skip reviewing a PR, add the following anywhere in the PR description:

```text
@cicero-ai: ignore
```

## Google Search Grounding

Cicero uses [Google Search grounding](https://ai.google.dev/gemini-api/docs/grounding/search-suggestions)
to enhance reviews with real-time information. This means:

- Reviews reference current best practices and security advisories
- Dependency checks use up-to-date vulnerability data
- Framework-specific suggestions reflect the latest documentation

Search grounding is enabled automatically for all reviews.

## Review from forks

GitHub Actions limits secret access from forked repositories. Use
`pull_request_target` instead of `pull_request`:

```yaml
on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  pull_request_review_comment:
    types: [created]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: arthrod/ai-pr-reviewer@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
        with:
          debug: false
```

See: [pull_request_target docs](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request_target)

## Debugging

Set `debug: true` in the workflow to enable debug mode and see the messages
exchanged with the Gemini API.

## Developing

Install dependencies:

```bash
npm install
```

Build and package:

```bash
npm run build && npm run package
```

## Disclaimer

- Your code (files, diff, PR title/description) will be sent to Google's Gemini
  API servers for processing. Please check with your compliance team before
  using this on private code repositories.
- This action is not affiliated with Google.

## License

MIT
