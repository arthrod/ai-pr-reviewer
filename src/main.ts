import {
  getBooleanInput,
  getInput,
  getMultilineInput,
  setFailed,
  warning
} from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import {Bot} from './bot'
import {GeminiOptions, Options} from './options'
import {Prompts} from './prompts'
import {codeReview} from './review'
import {handleReviewComment} from './review-comment'

// Load GEMINI_API_KEY from ~/.env/.env if not already set
function loadEnvFile(): void {
  if (!process.env.GEMINI_API_KEY) {
    const envPath = path.join(
      process.env.HOME || process.env.USERPROFILE || '',
      '.env',
      '.env'
    )
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8')
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const eqIndex = trimmed.indexOf('=')
            const key = trimmed.substring(0, eqIndex).trim()
            const value = trimmed.substring(eqIndex + 1).trim()
            if (!process.env[key]) {
              process.env[key] = value
            }
          }
        }
      }
    } catch {
      // ignore errors reading env file
    }
  }
}

loadEnvFile()

async function run(): Promise<void> {
  // Set GEMINI_API_KEY from action input if provided
  const geminiApiKey = getInput('gemini_api_key')
  if (geminiApiKey) {
    process.env.GEMINI_API_KEY = geminiApiKey
  }

  const options: Options = new Options(
    getBooleanInput('debug'),
    getBooleanInput('disable_review'),
    getBooleanInput('disable_release_notes'),
    getInput('max_files'),
    getBooleanInput('review_simple_changes'),
    getBooleanInput('review_comment_lgtm'),
    getMultilineInput('path_filters'),
    getInput('system_message'),
    getInput('gemini_light_model'),
    getInput('gemini_heavy_model'),
    getInput('gemini_model_temperature'),
    getInput('gemini_retries'),
    getInput('gemini_timeout_ms'),
    getInput('gemini_concurrency_limit'),
    getInput('github_concurrency_limit'),
    getInput('language'),
    getBooleanInput('enable_test_coverage_analysis'),
    getInput('test_coverage_threshold'),
    getInput('test_coverage_files'),
    getBooleanInput('enable_security_analysis'),
    getInput('security_severity_threshold'),
    getBooleanInput('enable_performance_analysis'),
    getInput('performance_score_threshold'),
    getBooleanInput('enable_complexity_analysis'),
    getInput('complexity_score_threshold'),
    getBooleanInput('enable_dependency_analysis'),
    getInput('dependency_security_threshold'),
    getBooleanInput('enable_documentation_analysis'),
    getInput('documentation_coverage_threshold'),
    getBooleanInput('enable_cicd_analysis'),
    getBooleanInput('cicd_merge_blocking'),
    getBooleanInput('cicd_strict_mode'),
    getInput('cicd_quality_gate_threshold'),
    getInput('cicd_security_gate_threshold'),
    getInput('cicd_performance_gate_threshold'),
    getInput('cicd_coverage_gate_threshold'),
    getInput('cicd_complexity_gate_threshold'),
    getInput('cicd_dependency_gate_threshold'),
    getInput('cicd_documentation_gate_threshold')
  )

  // print options
  options.print()

  const prompts: Prompts = new Prompts(
    getInput('summarize'),
    getInput('summarize_release_notes')
  )

  // Create two bots, one for summary and one for review

  let lightBot: Bot | null = null
  try {
    lightBot = new Bot(
      options,
      new GeminiOptions(options.geminiLightModel, options.lightTokenLimits)
    )
  } catch (e: any) {
    warning(
      `Skipped: failed to create summary bot, please check your GEMINI_API_KEY: ${e}, backtrace: ${e.stack}`
    )
    return
  }

  let heavyBot: Bot | null = null
  try {
    heavyBot = new Bot(
      options,
      new GeminiOptions(options.geminiHeavyModel, options.heavyTokenLimits)
    )
  } catch (e: any) {
    warning(
      `Skipped: failed to create review bot, please check your GEMINI_API_KEY: ${e}, backtrace: ${e.stack}`
    )
    return
  }

  try {
    // check if the event is pull_request
    if (
      process.env.GITHUB_EVENT_NAME === 'pull_request' ||
      process.env.GITHUB_EVENT_NAME === 'pull_request_target'
    ) {
      await codeReview(lightBot, heavyBot, options, prompts)
    } else if (
      process.env.GITHUB_EVENT_NAME === 'pull_request_review_comment'
    ) {
      await handleReviewComment(heavyBot, options, prompts)
    } else {
      warning('Skipped: this action only works on push events or pull_request')
    }
  } catch (e: any) {
    if (e instanceof Error) {
      setFailed(`Failed to run: ${e.message}, backtrace: ${e.stack}`)
    } else {
      setFailed(`Failed to run: ${e}, backtrace: ${e.stack}`)
    }
  }
}

process
  .on('unhandledRejection', (reason, p) => {
    warning(`Unhandled Rejection at Promise: ${reason}, promise is ${p}`)
  })
  .on('uncaughtException', (e: any) => {
    warning(`Uncaught Exception thrown: ${e}, backtrace: ${e.stack}`)
  })

await run()
