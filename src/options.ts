import {info} from '@actions/core'
import {minimatch} from 'minimatch'
import {TokenLimits} from './limits'

export class Options {
  debug: boolean
  disableReview: boolean
  disableReleaseNotes: boolean
  maxFiles: number
  reviewSimpleChanges: boolean
  reviewCommentLGTM: boolean
  pathFilters: PathFilter
  systemMessage: string
  openaiLightModel: string
  openaiHeavyModel: string
  openaiModelTemperature: number
  openaiRetries: number
  openaiTimeoutMS: number
  openaiConcurrencyLimit: number
  githubConcurrencyLimit: number
  lightTokenLimits: TokenLimits
  heavyTokenLimits: TokenLimits
  apiBaseUrl: string
  language: string
  enableTestCoverageAnalysis: boolean
  testCoverageThreshold: number
  testCoverageFiles: string[]
  enableSecurityAnalysis: boolean
  securitySeverityThreshold: string
  enablePerformanceAnalysis: boolean
  performanceScoreThreshold: number
  enableComplexityAnalysis: boolean
  complexityScoreThreshold: number
  enableDependencyAnalysis: boolean
  dependencySecurityThreshold: number
  enableDocumentationAnalysis: boolean
  documentationCoverageThreshold: number
  enableCICDAnalysis: boolean
  cicdMergeBlocking: boolean
  cicdStrictMode: boolean
  cicdQualityGateThreshold: number
  cicdSecurityGateThreshold: number
  cicdPerformanceGateThreshold: number
  cicdCoverageGateThreshold: number
  cicdComplexityGateThreshold: number
  cicdDependencyGateThreshold: number
  cicdDocumentationGateThreshold: number

  constructor(
    debug: boolean,
    disableReview: boolean,
    disableReleaseNotes: boolean,
    maxFiles = '0',
    reviewSimpleChanges = false,
    reviewCommentLGTM = false,
    pathFilters: string[] | null = null,
    systemMessage = '',
    openaiLightModel = 'gpt-3.5-turbo',
    openaiHeavyModel = 'gpt-3.5-turbo',
    openaiModelTemperature = '0.0',
    openaiRetries = '3',
    openaiTimeoutMS = '120000',
    openaiConcurrencyLimit = '6',
    githubConcurrencyLimit = '6',
    apiBaseUrl = 'https://api.openai.com/v1',
    language = 'en-US',
    enableTestCoverageAnalysis = true,
    testCoverageThreshold = '80',
    testCoverageFiles = 'coverage/coverage-summary.json,coverage/lcov.info,coverage/clover.xml,test-results/coverage.json,coverage/coverage.json',
    enableSecurityAnalysis = true,
    securitySeverityThreshold = 'medium',
    enablePerformanceAnalysis = true,
    performanceScoreThreshold = '70',
    enableComplexityAnalysis = true,
    complexityScoreThreshold = '75',
    enableDependencyAnalysis = true,
    dependencySecurityThreshold = '80',
    enableDocumentationAnalysis = true,
    documentationCoverageThreshold = '70',
    enableCICDAnalysis = true,
    cicdMergeBlocking = false,
    cicdStrictMode = false,
    cicdQualityGateThreshold = '80',
    cicdSecurityGateThreshold = '85',
    cicdPerformanceGateThreshold = '70',
    cicdCoverageGateThreshold = '80',
    cicdComplexityGateThreshold = '75',
    cicdDependencyGateThreshold = '80',
    cicdDocumentationGateThreshold = '70'
  ) {
    this.debug = debug
    this.disableReview = disableReview
    this.disableReleaseNotes = disableReleaseNotes
    this.maxFiles = parseInt(maxFiles)
    this.reviewSimpleChanges = reviewSimpleChanges
    this.reviewCommentLGTM = reviewCommentLGTM
    this.pathFilters = new PathFilter(pathFilters)
    this.systemMessage = systemMessage
    this.openaiLightModel = openaiLightModel
    this.openaiHeavyModel = openaiHeavyModel
    this.openaiModelTemperature = parseFloat(openaiModelTemperature)
    this.openaiRetries = parseInt(openaiRetries)
    this.openaiTimeoutMS = parseInt(openaiTimeoutMS)
    this.openaiConcurrencyLimit = parseInt(openaiConcurrencyLimit)
    this.githubConcurrencyLimit = parseInt(githubConcurrencyLimit)
    this.lightTokenLimits = new TokenLimits(openaiLightModel)
    this.heavyTokenLimits = new TokenLimits(openaiHeavyModel)
    this.apiBaseUrl = apiBaseUrl
    this.language = language
    this.enableTestCoverageAnalysis = enableTestCoverageAnalysis
    this.testCoverageThreshold = parseInt(testCoverageThreshold)
    this.testCoverageFiles = testCoverageFiles.split(',').map(f => f.trim())
    this.enableSecurityAnalysis = enableSecurityAnalysis
    this.securitySeverityThreshold = securitySeverityThreshold
    this.enablePerformanceAnalysis = enablePerformanceAnalysis
    this.performanceScoreThreshold = parseInt(performanceScoreThreshold)
    this.enableComplexityAnalysis = enableComplexityAnalysis
    this.complexityScoreThreshold = parseInt(complexityScoreThreshold)
    this.enableDependencyAnalysis = enableDependencyAnalysis
    this.dependencySecurityThreshold = parseInt(dependencySecurityThreshold)
    this.enableDocumentationAnalysis = enableDocumentationAnalysis
    this.documentationCoverageThreshold = parseInt(
      documentationCoverageThreshold
    )
    this.enableCICDAnalysis = enableCICDAnalysis
    this.cicdMergeBlocking = cicdMergeBlocking
    this.cicdStrictMode = cicdStrictMode
    this.cicdQualityGateThreshold = parseInt(cicdQualityGateThreshold)
    this.cicdSecurityGateThreshold = parseInt(cicdSecurityGateThreshold)
    this.cicdPerformanceGateThreshold = parseInt(cicdPerformanceGateThreshold)
    this.cicdCoverageGateThreshold = parseInt(cicdCoverageGateThreshold)
    this.cicdComplexityGateThreshold = parseInt(cicdComplexityGateThreshold)
    this.cicdDependencyGateThreshold = parseInt(cicdDependencyGateThreshold)
    this.cicdDocumentationGateThreshold = parseInt(
      cicdDocumentationGateThreshold
    )
  }

  // print all options using core.info
  print(): void {
    info(`debug: ${this.debug}`)
    info(`disable_review: ${this.disableReview}`)
    info(`disable_release_notes: ${this.disableReleaseNotes}`)
    info(`max_files: ${this.maxFiles}`)
    info(`review_simple_changes: ${this.reviewSimpleChanges}`)
    info(`review_comment_lgtm: ${this.reviewCommentLGTM}`)
    info(`path_filters: ${this.pathFilters}`)
    info(`system_message: ${this.systemMessage}`)
    info(`openai_light_model: ${this.openaiLightModel}`)
    info(`openai_heavy_model: ${this.openaiHeavyModel}`)
    info(`openai_model_temperature: ${this.openaiModelTemperature}`)
    info(`openai_retries: ${this.openaiRetries}`)
    info(`openai_timeout_ms: ${this.openaiTimeoutMS}`)
    info(`openai_concurrency_limit: ${this.openaiConcurrencyLimit}`)
    info(`github_concurrency_limit: ${this.githubConcurrencyLimit}`)
    info(`summary_token_limits: ${this.lightTokenLimits.string()}`)
    info(`review_token_limits: ${this.heavyTokenLimits.string()}`)
    info(`api_base_url: ${this.apiBaseUrl}`)
    info(`language: ${this.language}`)
    info(`enable_test_coverage_analysis: ${this.enableTestCoverageAnalysis}`)
    info(`test_coverage_threshold: ${this.testCoverageThreshold}`)
    info(`test_coverage_files: ${this.testCoverageFiles.join(', ')}`)
    info(`enable_security_analysis: ${this.enableSecurityAnalysis}`)
    info(`security_severity_threshold: ${this.securitySeverityThreshold}`)
    info(`enable_performance_analysis: ${this.enablePerformanceAnalysis}`)
    info(`performance_score_threshold: ${this.performanceScoreThreshold}`)
    info(`enable_complexity_analysis: ${this.enableComplexityAnalysis}`)
    info(`complexity_score_threshold: ${this.complexityScoreThreshold}`)
    info(`enable_dependency_analysis: ${this.enableDependencyAnalysis}`)
    info(`dependency_security_threshold: ${this.dependencySecurityThreshold}`)
    info(`enable_documentation_analysis: ${this.enableDocumentationAnalysis}`)
    info(
      `documentation_coverage_threshold: ${this.documentationCoverageThreshold}`
    )
    info(`enable_cicd_analysis: ${this.enableCICDAnalysis}`)
    info(`cicd_merge_blocking: ${this.cicdMergeBlocking}`)
    info(`cicd_strict_mode: ${this.cicdStrictMode}`)
    info(`cicd_quality_gate_threshold: ${this.cicdQualityGateThreshold}`)
    info(`cicd_security_gate_threshold: ${this.cicdSecurityGateThreshold}`)
    info(
      `cicd_performance_gate_threshold: ${this.cicdPerformanceGateThreshold}`
    )
    info(`cicd_coverage_gate_threshold: ${this.cicdCoverageGateThreshold}`)
    info(`cicd_complexity_gate_threshold: ${this.cicdComplexityGateThreshold}`)
    info(`cicd_dependency_gate_threshold: ${this.cicdDependencyGateThreshold}`)
    info(
      `cicd_documentation_gate_threshold: ${this.cicdDocumentationGateThreshold}`
    )
  }

  checkPath(path: string): boolean {
    const ok = this.pathFilters.check(path)
    info(`checking path: ${path} => ${ok}`)
    return ok
  }
}

export class PathFilter {
  private readonly rules: Array<[string /* rule */, boolean /* exclude */]>

  constructor(rules: string[] | null = null) {
    this.rules = []
    if (rules != null) {
      for (const rule of rules) {
        const trimmed = rule?.trim()
        if (trimmed) {
          if (trimmed.startsWith('!')) {
            this.rules.push([trimmed.substring(1).trim(), true])
          } else {
            this.rules.push([trimmed, false])
          }
        }
      }
    }
  }

  check(path: string): boolean {
    if (this.rules.length === 0) {
      return true
    }

    let included = false
    let excluded = false
    let inclusionRuleExists = false

    for (const [rule, exclude] of this.rules) {
      if (minimatch(path, rule)) {
        if (exclude) {
          excluded = true
        } else {
          included = true
        }
      }
      if (!exclude) {
        inclusionRuleExists = true
      }
    }

    return (!inclusionRuleExists || included) && !excluded
  }
}

export class OpenAIOptions {
  model: string
  tokenLimits: TokenLimits

  constructor(model = 'gpt-3.5-turbo', tokenLimits: TokenLimits | null = null) {
    this.model = model
    if (tokenLimits != null) {
      this.tokenLimits = tokenLimits
    } else {
      this.tokenLimits = new TokenLimits(model)
    }
  }
}
