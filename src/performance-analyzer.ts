import {info, warning} from '@actions/core'

export interface PerformanceIssue {
  type:
    | 'inefficient_algorithm'
    | 'database_query'
    | 'memory_leak'
    | 'resource_heavy'
    | 'blocking_operation'
    | 'nested_loops'
    | 'large_data_processing'
  severity: 'low' | 'medium' | 'high' | 'critical'
  filePath: string
  lineNumber: number
  description: string
  suggestion: string
  estimatedImpact: string
}

export interface PerformanceAnalysisResult {
  issues: PerformanceIssue[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  recommendations: string[]
  overallScore: number // 0-100, higher is better
}

export class PerformanceAnalyzer {
  private readonly performancePatterns = {
    inefficient_algorithm: [
      {
        pattern: /for\s*\([^)]*\)\s*\{\s*for\s*\([^)]*\)\s*\{/gi,
        description: 'Nested loops detected - potential O(n²) complexity',
        suggestion:
          'Consider using hash maps, sets, or optimizing the algorithm',
        estimatedImpact: 'High CPU usage for large datasets',
        severity: 'high' as const
      },
      {
        pattern: /\.forEach\s*\([^)]*\)\s*\.forEach\s*\(/gi,
        description: 'Nested forEach loops - potential performance issue',
        suggestion: 'Use for...of loops or consider algorithm optimization',
        estimatedImpact: 'Moderate CPU usage for large datasets',
        severity: 'medium' as const
      },
      {
        pattern: /while\s*\([^)]*\)\s*\{\s*while\s*\([^)]*\)\s*\{/gi,
        description: 'Nested while loops - potential O(n²) complexity',
        suggestion: 'Consider using hash maps or optimizing the algorithm',
        estimatedImpact: 'High CPU usage for large datasets',
        severity: 'high' as const
      }
    ],
    database_query: [
      {
        pattern: /SELECT\s+\*\s+FROM/gi,
        description: 'SELECT * query detected - may return unnecessary columns',
        suggestion: 'Specify only the columns you need',
        estimatedImpact: 'Increased network traffic and memory usage',
        severity: 'medium' as const
      },
      {
        pattern: /\.find\s*\(\s*\{\s*\$\s*\w+:/gi,
        description: 'MongoDB query without index hint',
        suggestion: 'Add appropriate indexes for query fields',
        estimatedImpact: 'Slow database queries for large collections',
        severity: 'high' as const
      },
      {
        pattern: /query\s*\(\s*['"`][^'"`]*\+[^'"`]*['"`]\s*\)/gi,
        description: 'Dynamic SQL query construction',
        suggestion: 'Use parameterized queries and prepared statements',
        estimatedImpact: 'SQL injection risk and poor query optimization',
        severity: 'critical' as const
      }
    ],
    memory_leak: [
      {
        pattern: /setInterval\s*\([^)]*\)/gi,
        description:
          'setInterval detected - potential memory leak if not cleared',
        suggestion: 'Ensure clearInterval is called when component unmounts',
        estimatedImpact: 'Memory leak over time',
        severity: 'high' as const
      },
      {
        pattern: /addEventListener\s*\([^)]*\)/gi,
        description:
          'Event listener detected - potential memory leak if not removed',
        suggestion: 'Ensure removeEventListener is called when appropriate',
        estimatedImpact: 'Memory leak over time',
        severity: 'medium' as const
      },
      {
        pattern: /setTimeout\s*\([^)]*\)/gi,
        description:
          'setTimeout detected - potential memory leak if not cleared',
        suggestion:
          'Consider using clearTimeout if timeout needs to be cancelled',
        estimatedImpact: 'Minor memory usage',
        severity: 'low' as const
      }
    ],
    resource_heavy: [
      {
        pattern: /Image\s*\(\s*\)\s*\.src\s*=/gi,
        description: 'Image loading detected without size optimization',
        suggestion: 'Use responsive images and lazy loading',
        estimatedImpact: 'Increased bandwidth and slower page load',
        severity: 'medium' as const
      },
      {
        pattern: /JSON\.parse\s*\(\s*[^)]*\)/gi,
        description: 'Large JSON parsing detected',
        suggestion: 'Consider streaming or chunked processing for large JSON',
        estimatedImpact: 'High CPU usage for large JSON objects',
        severity: 'medium' as const
      },
      {
        pattern: /new\s+Array\s*\(\s*\d+\s*\)/gi,
        description: 'Large array allocation detected',
        suggestion: 'Consider using typed arrays or lazy initialization',
        estimatedImpact: 'High memory usage',
        severity: 'medium' as const
      }
    ],
    blocking_operation: [
      {
        pattern: /fs\.readFileSync\s*\(/gi,
        description: 'Synchronous file I/O operation detected',
        suggestion: 'Use async/await with fs.promises or callbacks',
        estimatedImpact: 'Blocks event loop, poor responsiveness',
        severity: 'high' as const
      },
      {
        pattern: /child_process\.execSync\s*\(/gi,
        description: 'Synchronous process execution detected',
        suggestion: 'Use async child_process.exec or spawn',
        estimatedImpact: 'Blocks event loop, poor responsiveness',
        severity: 'critical' as const
      },
      {
        pattern: /crypto\.pbkdf2Sync\s*\(/gi,
        description: 'Synchronous cryptographic operation detected',
        suggestion: 'Use async crypto.pbkdf2',
        estimatedImpact: 'Blocks event loop, poor responsiveness',
        severity: 'high' as const
      }
    ],
    nested_loops: [
      {
        pattern:
          /for\s*\([^)]*\)\s*\{\s*[^}]*for\s*\([^)]*\)\s*\{[^}]*for\s*\([^)]*\)/gi,
        description: 'Triple nested loops detected - O(n³) complexity',
        suggestion: 'Redesign algorithm to reduce complexity',
        estimatedImpact: 'Very high CPU usage for large datasets',
        severity: 'critical' as const
      },
      {
        pattern: /\.map\s*\([^)]*\)\s*\.filter\s*\([^)]*\)\s*\.reduce\s*\(/gi,
        description: 'Chained array operations on large arrays',
        suggestion: 'Consider using for loops or single reduce operation',
        estimatedImpact: 'Multiple iterations over data',
        severity: 'medium' as const
      }
    ],
    large_data_processing: [
      {
        pattern: /\.length\s*>\s*\d{4,}/gi,
        description: 'Large array size check detected',
        suggestion: 'Consider pagination or streaming for large datasets',
        estimatedImpact: 'High memory usage',
        severity: 'medium' as const
      },
      {
        pattern: /substring\s*\([^)]*\)\s*\.length\s*>\s*\d{3,}/gi,
        description: 'Large string processing detected',
        suggestion: 'Consider chunking or streaming for large strings',
        estimatedImpact: 'High memory usage',
        severity: 'medium' as const
      }
    ]
  }

  async analyzePerformance(
    filePaths: string[],
    fileContents: Map<string, string>
  ): Promise<PerformanceAnalysisResult> {
    const issues: PerformanceIssue[] = []

    for (const filePath of filePaths) {
      const content = fileContents.get(filePath)
      if (!content) continue

      const fileIssues = this.analyzeFile(filePath, content)
      issues.push(...fileIssues)
    }

    return this.generatePerformanceResult(issues)
  }

  private analyzeFile(filePath: string, content: string): PerformanceIssue[] {
    const issues: PerformanceIssue[] = []
    const lines = content.split('\n')

    for (const [issueType, patterns] of Object.entries(
      this.performancePatterns
    )) {
      for (const patternObj of patterns) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (patternObj.pattern.test(line)) {
            const issue: PerformanceIssue = {
              type: issueType as PerformanceIssue['type'],
              severity: patternObj.severity,
              filePath,
              lineNumber: i + 1,
              description: patternObj.description,
              suggestion: patternObj.suggestion,
              estimatedImpact: patternObj.estimatedImpact
            }
            issues.push(issue)
          }
        }
      }
    }

    return issues
  }

  private generatePerformanceResult(
    issues: PerformanceIssue[]
  ): PerformanceAnalysisResult {
    const summary = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }

    const recommendations = this.generateRecommendations(issues)
    const overallScore = this.calculatePerformanceScore(issues)

    return {
      issues,
      summary,
      recommendations,
      overallScore
    }
  }

  private generateRecommendations(issues: PerformanceIssue[]): string[] {
    const recommendations: string[] = []

    if (this.hasIssueType(issues, 'inefficient_algorithm')) {
      recommendations.push(
        '🚀 Profile and optimize algorithms with high time complexity'
      )
    }

    if (this.hasIssueType(issues, 'database_query')) {
      recommendations.push(
        '🗄️ Optimize database queries and add appropriate indexes'
      )
    }

    if (this.hasIssueType(issues, 'memory_leak')) {
      recommendations.push(
        '🧹 Implement proper cleanup to prevent memory leaks'
      )
    }

    if (this.hasIssueType(issues, 'resource_heavy')) {
      recommendations.push(
        '⚡ Optimize resource usage and implement lazy loading'
      )
    }

    if (this.hasIssueType(issues, 'blocking_operation')) {
      recommendations.push(
        '🔄 Replace synchronous operations with async alternatives'
      )
    }

    if (this.hasIssueType(issues, 'nested_loops')) {
      recommendations.push(
        '🔢 Redesign nested loops to reduce algorithmic complexity'
      )
    }

    if (this.hasIssueType(issues, 'large_data_processing')) {
      recommendations.push(
        '📊 Implement pagination or streaming for large datasets'
      )
    }

    // General recommendations
    if (issues.length > 0) {
      recommendations.push(
        '📈 Use performance monitoring tools to track bottlenecks'
      )
      recommendations.push('🧪 Implement performance testing in CI/CD pipeline')
      recommendations.push(
        '🔍 Regularly profile your application for performance issues'
      )
    }

    return recommendations
  }

  private hasIssueType(
    issues: PerformanceIssue[],
    type: PerformanceIssue['type']
  ): boolean {
    return issues.some(i => i.type === type)
  }

  private calculatePerformanceScore(issues: PerformanceIssue[]): number {
    if (issues.length === 0) return 100

    const severityWeights = {
      critical: 40,
      high: 20,
      medium: 10,
      low: 5
    }

    const totalDeduction = issues.reduce((sum, issue) => {
      return sum + severityWeights[issue.severity]
    }, 0)

    return Math.max(0, 100 - totalDeduction)
  }

  generatePerformanceComment(result: PerformanceAnalysisResult): string {
    let comment = `## ⚡ Performance Impact Assessment\n\n`

    const totalIssues =
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low

    if (totalIssues === 0) {
      comment += `✅ **No performance issues detected** in the changed files.\n\n`
      comment += `### 📊 Performance Score: ${result.overallScore}/100\n\n`
      comment += `### 💡 Performance Best Practices\n\n`
      comment += `- Continue following performance optimization practices\n`
      comment += `- Regularly profile your application\n`
      comment += `- Monitor performance metrics in production\n`
      return comment
    }

    comment += `📊 **Performance Score: ${result.overallScore}/100**\n\n`
    comment += `⚠️ **${totalIssues} performance issues found**\n\n`

    comment += `### 📈 Severity Breakdown\n\n`
    comment += `- 🔴 **Critical**: ${result.summary.critical}\n`
    comment += `- 🟠 **High**: ${result.summary.high}\n`
    comment += `- 🟡 **Medium**: ${result.summary.medium}\n`
    comment += `- 🟢 **Low**: ${result.summary.low}\n\n`

    // Group issues by severity and type
    const criticalIssues = result.issues.filter(i => i.severity === 'critical')
    const highIssues = result.issues.filter(i => i.severity === 'high')

    if (criticalIssues.length > 0) {
      comment += `### 🔴 Critical Performance Issues\n\n`
      for (const issue of criticalIssues.slice(0, 3)) {
        // Limit to 3 for readability
        comment += `- **${issue.filePath}:${issue.lineNumber}** - ${issue.description}\n`
        comment += `  - **Impact**: ${issue.estimatedImpact}\n`
        comment += `  - **Suggestion**: ${issue.suggestion}\n\n`
      }
      if (criticalIssues.length > 3) {
        comment += `- ... and ${
          criticalIssues.length - 3
        } more critical issues\n\n`
      }
    }

    if (highIssues.length > 0) {
      comment += `### 🟠 High Severity Issues\n\n`
      for (const issue of highIssues.slice(0, 3)) {
        // Limit to 3 for readability
        comment += `- **${issue.filePath}:${issue.lineNumber}** - ${issue.description}\n`
        comment += `  - **Impact**: ${issue.estimatedImpact}\n`
        comment += `  - **Suggestion**: ${issue.suggestion}\n\n`
      }
      if (highIssues.length > 3) {
        comment += `- ... and ${
          highIssues.length - 3
        } more high severity issues\n\n`
      }
    }

    if (result.recommendations.length > 0) {
      comment += `### 💡 Performance Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    return comment
  }
}
