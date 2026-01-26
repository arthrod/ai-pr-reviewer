import {
  getBooleanInput,
  getInput,
  getMultilineInput,
  setFailed,
  warning
} from '@actions/core'
import {Bot} from './bot'
import {OpenAIOptions, Options} from './options'
import {Prompts} from './prompts'
import {codeReview} from './review'
import {handleReviewComment} from './review-comment'

async function run(): Promise<void> {
  const options: Options = new Options(
    getBooleanInput('debug'),
    getBooleanInput('disable_review'),
    getBooleanInput('disable_release_notes'),
    getInput('max_files'),
    getBooleanInput('review_simple_changes'),
    getBooleanInput('review_comment_lgtm'),
    getMultilineInput('path_filters'),
    getInput('system_message'),
    getInput('openai_light_model'),
    getInput('openai_heavy_model'),
    getInput('openai_model_temperature'),
    getInput('openai_retries'),
    getInput('openai_timeout_ms'),
    getInput('openai_concurrency_limit'),
    getInput('github_concurrency_limit'),
    getInput('openai_base_url'),
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
      new OpenAIOptions(options.openaiLightModel, options.lightTokenLimits)
    )
  } catch (e: any) {
    warning(
      `Skipped: failed to create summary bot, please check your openai_api_key: ${e}, backtrace: ${e.stack}`
    )
    return
  }

  let heavyBot: Bot | null = null
  try {
    heavyBot = new Bot(
      options,
      new OpenAIOptions(options.openaiHeavyModel, options.heavyTokenLimits)
    )
  } catch (e: any) {
    warning(
      `Skipped: failed to create review bot, please check your openai_api_key: ${e}, backtrace: ${e.stack}`
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
