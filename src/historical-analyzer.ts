import {info, warning} from '@actions/core'

export interface HistoricalPattern {
  type:
    | 'common_issue'
    | 'recurring_bug'
    | 'performance_pattern'
    | 'security_pattern'
    | 'style_pattern'
    | 'test_pattern'
  frequency: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  examples: string[]
  recommendation: string
  confidence: number
  lastSeen: Date
}

export interface HistoricalMetrics {
  totalReviews: number
  patternsFound: number
  avgConfidence: number
  mostCommonType: string
  improvementTrend: 'improving' | 'stable' | 'declining'
}

export interface HistoricalAnalysisResult {
  patterns: HistoricalPattern[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  metrics: HistoricalMetrics
  recommendations: string[]
  learningInsights: string[]
}

export class HistoricalAnalyzer {
  private readonly historicalData: Map<string, any> = new Map()
  private reviewHistory: any[] = []

  constructor() {
    this.initializeMockHistoricalData()
  }

  private initializeMockHistoricalData(): void {
    // Mock historical review data
    this.reviewHistory = [
      {
        date: new Date('2024-01-15'),
        prNumber: 123,
        issues: [
          {
            type: 'security_pattern',
            description: 'SQL injection vulnerability',
            severity: 'critical'
          },
          {
            type: 'performance_pattern',
            description: 'N+1 query problem',
            severity: 'high'
          }
        ],
        files: ['src/api/users.js', 'src/database/queries.js']
      },
      {
        date: new Date('2024-01-20'),
        prNumber: 124,
        issues: [
          {
            type: 'common_issue',
            description: 'Missing error handling',
            severity: 'medium'
          },
          {
            type: 'style_pattern',
            description: 'Inconsistent naming',
            severity: 'low'
          }
        ],
        files: ['src/utils/helpers.js', 'src/middleware/auth.js']
      },
      {
        date: new Date('2024-01-25'),
        prNumber: 125,
        issues: [
          {
            type: 'security_pattern',
            description: 'XSS vulnerability',
            severity: 'critical'
          },
          {
            type: 'test_pattern',
            description: 'Missing unit tests',
            severity: 'medium'
          }
        ],
        files: ['src/templates/render.js', 'src/tests/']
      },
      {
        date: new Date('2024-02-01'),
        prNumber: 126,
        issues: [
          {
            type: 'performance_pattern',
            description: 'Memory leak in loop',
            severity: 'high'
          },
          {
            type: 'common_issue',
            description: 'Missing error handling',
            severity: 'medium'
          }
        ],
        files: ['src/processors/data.js', 'src/utils/async.js']
      },
      {
        date: new Date('2024-02-05'),
        prNumber: 127,
        issues: [
          {
            type: 'recurring_bug',
            description: 'Null reference exception',
            severity: 'high'
          },
          {
            type: 'style_pattern',
            description: 'Code duplication',
            severity: 'medium'
          }
        ],
        files: ['src/models/user.js', 'src/services/order.js']
      }
    ]

    // Initialize pattern detection rules
    this.historicalData.set('common_patterns', {
      missing_error_handling: {
        keywords: ['catch', 'error', 'exception', 'try'],
        frequency: 3,
        severity: 'medium',
        recommendation: 'Add proper error handling with try-catch blocks'
      },
      sql_injection: {
        keywords: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', '$', 'query'],
        frequency: 2,
        severity: 'critical',
        recommendation:
          'Use parameterized queries or ORM to prevent SQL injection'
      },
      xss_vulnerability: {
        keywords: ['innerHTML', 'document.write', 'eval', 'script'],
        frequency: 2,
        severity: 'critical',
        recommendation:
          'Sanitize user input and use safe HTML rendering methods'
      },
      n_plus_one_query: {
        keywords: ['forEach', 'query', 'select', 'database'],
        frequency: 2,
        severity: 'high',
        recommendation:
          'Use bulk queries or eager loading to avoid N+1 problems'
      },
      memory_leak: {
        keywords: [
          'setInterval',
          'setTimeout',
          'addEventListener',
          'removeEventListener'
        ],
        frequency: 2,
        severity: 'high',
        recommendation: 'Ensure proper cleanup of event listeners and timers'
      },
      null_reference: {
        keywords: ['null', 'undefined', 'optional chaining', '?'],
        frequency: 2,
        severity: 'high',
        recommendation:
          'Add null checks and use optional chaining where appropriate'
      },
      inconsistent_naming: {
        keywords: ['camelCase', 'snake_case', 'PascalCase'],
        frequency: 2,
        severity: 'low',
        recommendation:
          'Follow consistent naming conventions throughout the codebase'
      },
      code_duplication: {
        keywords: ['duplicate', 'similar', 'refactor', 'extract'],
        frequency: 2,
        severity: 'medium',
        recommendation: 'Extract common code into reusable functions or classes'
      },
      missing_tests: {
        keywords: ['test', 'spec', 'describe', 'it'],
        frequency: 2,
        severity: 'medium',
        recommendation: 'Add comprehensive unit tests for new functionality'
      }
    })
  }

  async analyzeHistoricalPatterns(
    changedFiles: string[],
    fileContents: Map<string, string>
  ): Promise<HistoricalAnalysisResult> {
    const patterns: HistoricalPattern[] = []

    // Analyze current changes against historical patterns
    for (const filePath of changedFiles) {
      const content = fileContents.get(filePath)
      if (!content) continue

      const filePatterns = await this.analyzeFileForPatterns(filePath, content)
      patterns.push(...filePatterns)
    }

    // Analyze trends and improvements
    const trendAnalysis = this.analyzeTrends()

    // Consolidate and rank patterns
    const consolidatedPatterns = this.consolidatePatterns(patterns)

    const summary = {
      critical: consolidatedPatterns.filter(p => p.severity === 'critical')
        .length,
      high: consolidatedPatterns.filter(p => p.severity === 'high').length,
      medium: consolidatedPatterns.filter(p => p.severity === 'medium').length,
      low: consolidatedPatterns.filter(p => p.severity === 'low').length
    }

    const metrics = this.calculateMetrics(consolidatedPatterns, trendAnalysis)
    const recommendations = this.generateRecommendations(
      consolidatedPatterns,
      trendAnalysis
    )
    const learningInsights = this.generateLearningInsights(
      consolidatedPatterns,
      trendAnalysis
    )

    return {
      patterns: consolidatedPatterns,
      summary,
      metrics,
      recommendations,
      learningInsights
    }
  }

  private async analyzeFileForPatterns(
    filePath: string,
    content: string
  ): Promise<HistoricalPattern[]> {
    const patterns: HistoricalPattern[] = []
    const commonPatterns = this.historicalData.get('common_patterns')

    // Check each historical pattern
    for (const [patternId, patternData] of Object.entries(commonPatterns)) {
      const patternDataTyped = patternData as {
        keywords: string[]
        frequency: number
        severity: string
        recommendation: string
      }

      const match = this.checkPatternMatch(content, patternDataTyped)

      if (match.matched) {
        patterns.push({
          type: this.mapPatternType(patternId),
          frequency: patternDataTyped.frequency,
          severity: patternDataTyped.severity as
            | 'low'
            | 'medium'
            | 'high'
            | 'critical',
          description: match.description,
          examples: match.examples,
          recommendation: patternDataTyped.recommendation,
          confidence: match.confidence,
          lastSeen: this.getLastSeenDate(patternId)
        })
      }
    }

    // Check for file-specific patterns
    const filePatterns = this.analyzeFileSpecificPatterns(filePath, content)
    patterns.push(...filePatterns)

    return patterns
  }

  private checkPatternMatch(
    content: string,
    patternData: {
      keywords: string[]
      frequency: number
      severity: string
      recommendation: string
    }
  ): {
    matched: boolean
    description: string
    examples: string[]
    confidence: number
  } {
    const keywords = patternData.keywords as string[]
    let matchCount = 0
    const examples: string[] = []

    for (const keyword of keywords) {
      const regex = new RegExp(keyword, 'gi')
      const matches = content.match(regex)
      if (matches) {
        matchCount += matches.length
        // Extract context around matches
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(keyword.toLowerCase())) {
            const context =
              lines[Math.max(0, i - 1)] +
              '\n' +
              lines[i] +
              '\n' +
              lines[Math.min(lines.length - 1, i + 1)]
            examples.push(context.trim())
            if (examples.length >= 3) break // Limit examples
          }
        }
      }
    }

    const confidence = Math.min(95, (matchCount / keywords.length) * 100)
    const matched = confidence > 30 // Threshold for pattern matching

    return {
      matched,
      description: this.generatePatternDescription(keywords, matchCount),
      examples,
      confidence
    }
  }

  private analyzeFileSpecificPatterns(
    filePath: string,
    content: string
  ): HistoricalPattern[] {
    const patterns: HistoricalPattern[] = []

    // Check for specific file type patterns
    if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
      // JavaScript/TypeScript specific patterns
      const jsPatterns = this.analyzeJavaScriptPatterns(content)
      patterns.push(...jsPatterns)
    } else if (filePath.endsWith('.py')) {
      // Python specific patterns
      const pyPatterns = this.analyzePythonPatterns(content)
      patterns.push(...pyPatterns)
    }

    return patterns
  }

  private analyzeJavaScriptPatterns(content: string): HistoricalPattern[] {
    const patterns: HistoricalPattern[] = []

    // Check for async/await patterns
    const asyncPattern = /async\s+\w+\s*\([^)]*\)\s*=>/g
    if (
      asyncPattern.test(content) &&
      !content.includes('try') &&
      !content.includes('catch')
    ) {
      patterns.push({
        type: 'common_issue',
        frequency: 2,
        severity: 'medium',
        description: 'Async function without error handling',
        examples: ['async function without try-catch'],
        recommendation: 'Add proper error handling for async operations',
        confidence: 75,
        lastSeen: new Date('2024-02-01')
      })
    }

    // Check for console.log in production code
    const consolePattern = /console\.(log|error|warn|debug)/g
    const consoleMatches = content.match(consolePattern)
    if (consoleMatches && consoleMatches.length > 2) {
      patterns.push({
        type: 'style_pattern',
        frequency: 3,
        severity: 'low',
        description: 'Multiple console statements found',
        examples: consoleMatches.slice(0, 3),
        recommendation: 'Remove or replace with proper logging framework',
        confidence: 80,
        lastSeen: new Date('2024-01-20')
      })
    }

    return patterns
  }

  private analyzePythonPatterns(content: string): HistoricalPattern[] {
    const patterns: HistoricalPattern[] = []

    // Check for print statements in production code
    const printPattern = /print\s*\(/g
    const printMatches = content.match(printPattern)
    if (printMatches && printMatches.length > 2) {
      patterns.push({
        type: 'style_pattern',
        frequency: 2,
        severity: 'low',
        description: 'Multiple print statements found',
        examples: printMatches.slice(0, 3),
        recommendation: 'Use proper logging instead of print statements',
        confidence: 75,
        lastSeen: new Date('2024-01-25')
      })
    }

    return patterns
  }

  private mapPatternType(patternId: string): HistoricalPattern['type'] {
    const typeMapping: Record<string, HistoricalPattern['type']> = {
      missing_error_handling: 'common_issue',
      sql_injection: 'security_pattern',
      xss_vulnerability: 'security_pattern',
      n_plus_one_query: 'performance_pattern',
      memory_leak: 'performance_pattern',
      null_reference: 'recurring_bug',
      inconsistent_naming: 'style_pattern',
      code_duplication: 'style_pattern',
      missing_tests: 'test_pattern'
    }

    return typeMapping[patternId] || 'common_issue'
  }

  private generatePatternDescription(
    keywords: string[],
    matchCount: number
  ): string {
    const keywordList = keywords.slice(0, 3).join(', ')
    return `Pattern detected: ${keywordList} (${matchCount} occurrences)`
  }

  private getLastSeenDate(patternId: string): Date {
    // Find the most recent occurrence of this pattern in historical data
    let lastSeen = new Date('2024-01-01')

    for (const review of this.reviewHistory) {
      for (const issue of review.issues) {
        if (
          issue.type === this.mapPatternType(patternId) &&
          review.date > lastSeen
        ) {
          lastSeen = review.date
        }
      }
    }

    return lastSeen
  }

  private analyzeTrends(): {
    improvementTrend: 'improving' | 'stable' | 'declining'
    mostCommonType: string
  } {
    // Analyze trends from historical data
    const recentReviews = this.reviewHistory.slice(-3)
    const olderReviews = this.reviewHistory.slice(0, -3)

    const recentIssueCount = recentReviews.reduce(
      (sum, r) => sum + r.issues.length,
      0
    )
    const olderIssueCount = olderReviews.reduce(
      (sum, r) => sum + r.issues.length,
      0
    )

    let improvementTrend: 'improving' | 'stable' | 'declining'
    if (recentIssueCount < olderIssueCount * 0.8) {
      improvementTrend = 'improving'
    } else if (recentIssueCount > olderIssueCount * 1.2) {
      improvementTrend = 'declining'
    } else {
      improvementTrend = 'stable'
    }

    // Find most common issue type
    const typeCounts = new Map<string, number>()
    for (const review of this.reviewHistory) {
      for (const issue of review.issues) {
        typeCounts.set(issue.type, (typeCounts.get(issue.type) || 0) + 1)
      }
    }

    const mostCommonType =
      Array.from(typeCounts.entries()).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'common_issue'

    return {improvementTrend, mostCommonType}
  }

  private consolidatePatterns(
    patterns: HistoricalPattern[]
  ): HistoricalPattern[] {
    // Group similar patterns and consolidate
    const consolidated = new Map<string, HistoricalPattern>()

    for (const pattern of patterns) {
      const key = `${pattern.type}-${pattern.description.substring(0, 50)}`

      if (!consolidated.has(key)) {
        consolidated.set(key, {...pattern})
      } else {
        const existing = consolidated.get(key)!
        existing.frequency += pattern.frequency
        existing.confidence = Math.max(existing.confidence, pattern.confidence)
        existing.examples.push(...pattern.examples.slice(0, 2)) // Limit examples
      }
    }

    return Array.from(consolidated.values())
  }

  private calculateMetrics(
    patterns: HistoricalPattern[],
    trendAnalysis: {improvementTrend: string; mostCommonType: string}
  ): HistoricalMetrics {
    const avgConfidence =
      patterns.length > 0
        ? patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length
        : 0

    return {
      totalReviews: this.reviewHistory.length,
      patternsFound: patterns.length,
      avgConfidence: Math.round(avgConfidence),
      mostCommonType: trendAnalysis.mostCommonType,
      improvementTrend: trendAnalysis.improvementTrend as
        | 'improving'
        | 'stable'
        | 'declining'
    }
  }

  private generateRecommendations(
    patterns: HistoricalPattern[],
    trendAnalysis: {improvementTrend: string; mostCommonType: string}
  ): string[] {
    const recommendations: string[] = []

    // Pattern-specific recommendations
    if (patterns.some(p => p.type === 'security_pattern')) {
      recommendations.push(
        '🔒 **Security Patterns**: Implement security training and code review checklists'
      )
    }

    if (patterns.some(p => p.type === 'performance_pattern')) {
      recommendations.push(
        '⚡ **Performance Patterns**: Add performance testing and monitoring'
      )
    }

    if (patterns.some(p => p.type === 'common_issue')) {
      recommendations.push(
        '🔧 **Common Issues**: Create shared utilities and templates for frequent problems'
      )
    }

    if (patterns.some(p => p.type === 'test_pattern')) {
      recommendations.push(
        '🧪 **Test Patterns**: Improve test coverage and automated testing'
      )
    }

    // Trend-based recommendations
    if (trendAnalysis.improvementTrend === 'declining') {
      recommendations.push(
        '📉 **Quality Decline**: Review code review process and provide additional training'
      )
    } else if (trendAnalysis.improvementTrend === 'improving') {
      recommendations.push(
        '📈 **Quality Improving**: Continue current practices and share success stories'
      )
    }

    // General recommendations
    recommendations.push(
      '📚 **Knowledge Sharing**: Document common patterns and solutions'
    )
    recommendations.push(
      '🔄 **Automated Detection**: Implement automated tools to catch recurring patterns'
    )
    recommendations.push(
      '📊 **Metrics Tracking**: Monitor pattern frequency over time'
    )
    recommendations.push(
      '🎯 **Focused Training**: Target training based on most common patterns'
    )

    return recommendations
  }

  private generateLearningInsights(
    patterns: HistoricalPattern[],
    trendAnalysis: {improvementTrend: string; mostCommonType: string}
  ): string[] {
    const insights: string[] = []

    insights.push(
      `📊 **Pattern Analysis**: Found ${patterns.length} historical patterns in current changes`
    )
    insights.push(
      `🎯 **Most Common**: ${trendAnalysis.mostCommonType.replace(
        '_',
        ' '
      )} is the most frequent issue type`
    )
    insights.push(
      `📈 **Trend**: Code quality is ${trendAnalysis.improvementTrend} based on historical data`
    )

    // Specific insights based on patterns found
    const criticalPatterns = patterns.filter(p => p.severity === 'critical')
    if (criticalPatterns.length > 0) {
      insights.push(
        `🚨 **Critical Patterns**: ${criticalPatterns.length} critical patterns detected that have caused issues before`
      )
    }

    const highConfidencePatterns = patterns.filter(p => p.confidence > 80)
    if (highConfidencePatterns.length > 0) {
      insights.push(
        `🎯 **High Confidence**: ${highConfidencePatterns.length} patterns with >80% confidence match`
      )
    }

    // Learning opportunities
    insights.push(
      `💡 **Learning Opportunity**: Focus on ${trendAnalysis.mostCommonType} to prevent future issues`
    )
    insights.push(
      `🔄 **Continuous Improvement**: Use pattern data to refine development practices`
    )

    return insights
  }

  generateHistoricalComment(result: HistoricalAnalysisResult): string {
    let comment = `## 🧠 Historical Pattern Learning\n\n`

    const trendEmojis = {
      improving: '📈',
      stable: '➡️',
      declining: '📉'
    }

    comment += `${
      trendEmojis[result.metrics.improvementTrend]
    } **Quality Trend: ${result.metrics.improvementTrend.toUpperCase()}**\n\n`

    comment += `### 📊 Pattern Analysis Summary\n\n`
    comment += `- **Patterns Found**: ${result.metrics.patternsFound}\n`
    comment += `- **Critical**: ${result.summary.critical}\n`
    comment += `- **High**: ${result.summary.high}\n`
    comment += `- **Medium**: ${result.summary.medium}\n`
    comment += `- **Low**: ${result.summary.low}\n`
    comment += `- **Average Confidence**: ${result.metrics.avgConfidence}%\n`
    comment += `- **Most Common Type**: ${result.metrics.mostCommonType.replace(
      '_',
      ' '
    )}\n\n`

    if (result.patterns.length > 0) {
      comment += `### 🎯 Detected Historical Patterns\n\n`

      // Group patterns by type
      const patternsByType = result.patterns.reduce((acc, pattern) => {
        if (!acc[pattern.type]) acc[pattern.type] = []
        acc[pattern.type].push(pattern)
        return acc
      }, {} as Record<string, HistoricalPattern[]>)

      for (const [type, patterns] of Object.entries(patternsByType)) {
        const typeEmojis = {
          common_issue: '🔧',
          recurring_bug: '🐛',
          performance_pattern: '⚡',
          security_pattern: '🔒',
          style_pattern: '🎨',
          test_pattern: '🧪'
        }

        comment += `#### ${
          typeEmojis[type as keyof typeof typeEmojis] || '📋'
        } ${type.replace('_', ' ').toUpperCase()}\n\n`

        for (const pattern of patterns.slice(0, 2)) {
          // Limit to 2 per type
          const severityEmoji = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
          }

          comment += `- **${pattern.description}**\n`
          comment += `  ${severityEmoji[pattern.severity]} **Severity**: ${
            pattern.severity
          }\n`
          comment += `  📊 **Frequency**: ${pattern.frequency} times in history\n`
          comment += `  🎯 **Confidence**: ${pattern.confidence}%\n`
          comment += `  📅 **Last Seen**: ${pattern.lastSeen.toLocaleDateString()}\n`
          comment += `  💡 **Recommendation**: ${pattern.recommendation}\n\n`
        }

        if (patterns.length > 2) {
          comment += `- ... and ${
            patterns.length - 2
          } more patterns of this type\n\n`
        }
      }
    }

    if (result.learningInsights.length > 0) {
      comment += `### 💡 Learning Insights\n\n`
      result.learningInsights.forEach(insight => {
        comment += `${insight}\n`
      })
      comment += '\n'
    }

    if (result.recommendations.length > 0) {
      comment += `### 🎯 Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
      comment += '\n'
    }

    comment += `### 📚 Historical Context\n\n`
    comment += `This analysis is based on ${result.metrics.totalReviews} previous code reviews. `
    comment += `The system learns from past issues to provide context-aware suggestions and prevent recurring problems.\n\n`

    comment += `### 🔄 Continuous Learning\n\n`
    comment += `- **Pattern Detection**: Automatically identifies recurring issues\n`
    comment += `- **Trend Analysis**: Monitors code quality over time\n`
    comment += `- **Adaptive Feedback**: Improves recommendations based on outcomes\n`
    comment += `- **Knowledge Base**: Builds institutional memory from review history\n\n`

    return comment
  }
}
