import {info, warning} from '@actions/core'

export interface ComplexityIssue {
  type:
    | 'high_cyclomatic'
    | 'high_cognitive'
    | 'deep_nesting'
    | 'large_function'
    | 'too_many_parameters'
    | 'complex_condition'
    | 'long_line'
  severity: 'low' | 'medium' | 'high' | 'critical'
  filePath: string
  lineNumber: number
  functionName?: string
  description: string
  value: number
  threshold: number
  suggestion: string
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number
  cognitiveComplexity: number
  nestingDepth: number
  functionLength: number
  parameterCount: number
  lineLength: number
}

export interface ComplexityAnalysisResult {
  issues: ComplexityIssue[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  metrics: {
    totalFunctions: number
    averageComplexity: number
    maxComplexity: number
    averageCognitive: number
    maxCognitive: number
    averageNesting: number
    maxNesting: number
  }
  recommendations: string[]
  overallScore: number // 0-100, higher is better
}

export class ComplexityAnalyzer {
  private readonly thresholds = {
    cyclomaticComplexity: {
      low: 5,
      medium: 10,
      high: 20,
      critical: 50
    },
    cognitiveComplexity: {
      low: 10,
      medium: 20,
      high: 30,
      critical: 50
    },
    nestingDepth: {
      low: 3,
      medium: 5,
      high: 7,
      critical: 10
    },
    functionLength: {
      low: 20,
      medium: 50,
      high: 100,
      critical: 200
    },
    parameterCount: {
      low: 5,
      medium: 7,
      high: 10,
      critical: 15
    },
    lineLength: {
      low: 80,
      medium: 100,
      high: 120,
      critical: 150
    }
  }

  async analyzeComplexity(
    filePaths: string[],
    fileContents: Map<string, string>
  ): Promise<ComplexityAnalysisResult> {
    const issues: ComplexityIssue[] = []
    const allMetrics: ComplexityMetrics[] = []

    for (const filePath of filePaths) {
      const content = fileContents.get(filePath)
      if (!content) continue

      const fileIssues = this.analyzeFile(filePath, content)
      issues.push(...fileIssues.issues)
      allMetrics.push(...fileIssues.metrics)
    }

    return this.generateComplexityResult(issues, allMetrics)
  }

  private analyzeFile(
    filePath: string,
    content: string
  ): {issues: ComplexityIssue[]; metrics: ComplexityMetrics[]} {
    const issues: ComplexityIssue[] = []
    const metrics: ComplexityMetrics[] = []
    const lines = content.split('\n')

    // Find functions and analyze each
    const functions = this.extractFunctions(content, lines)

    for (const func of functions) {
      const funcMetrics = this.calculateFunctionMetrics(func, lines)
      metrics.push(funcMetrics)

      // Check cyclomatic complexity
      if (
        funcMetrics.cyclomaticComplexity >
        this.thresholds.cyclomaticComplexity.low
      ) {
        const severity = this.getSeverity(
          funcMetrics.cyclomaticComplexity,
          this.thresholds.cyclomaticComplexity
        )
        issues.push({
          type: 'high_cyclomatic',
          severity,
          filePath,
          lineNumber: func.startLine,
          functionName: func.name,
          description: `High cyclomatic complexity: ${funcMetrics.cyclomaticComplexity}`,
          value: funcMetrics.cyclomaticComplexity,
          threshold: this.thresholds.cyclomaticComplexity[severity],
          suggestion:
            'Consider breaking down into smaller functions or reducing conditional logic'
        })
      }

      // Check cognitive complexity
      if (
        funcMetrics.cognitiveComplexity >
        this.thresholds.cognitiveComplexity.low
      ) {
        const severity = this.getSeverity(
          funcMetrics.cognitiveComplexity,
          this.thresholds.cognitiveComplexity
        )
        issues.push({
          type: 'high_cognitive',
          severity,
          filePath,
          lineNumber: func.startLine,
          functionName: func.name,
          description: `High cognitive complexity: ${funcMetrics.cognitiveComplexity}`,
          value: funcMetrics.cognitiveComplexity,
          threshold: this.thresholds.cognitiveComplexity[severity],
          suggestion:
            'Simplify control flow, reduce nesting, and extract helper functions'
        })
      }

      // Check function length
      if (funcMetrics.functionLength > this.thresholds.functionLength.low) {
        const severity = this.getSeverity(
          funcMetrics.functionLength,
          this.thresholds.functionLength
        )
        issues.push({
          type: 'large_function',
          severity,
          filePath,
          lineNumber: func.startLine,
          functionName: func.name,
          description: `Large function: ${funcMetrics.functionLength} lines`,
          value: funcMetrics.functionLength,
          threshold: this.thresholds.functionLength[severity],
          suggestion: 'Break down into smaller, more focused functions'
        })
      }

      // Check parameter count
      if (funcMetrics.parameterCount > this.thresholds.parameterCount.low) {
        const severity = this.getSeverity(
          funcMetrics.parameterCount,
          this.thresholds.parameterCount
        )
        issues.push({
          type: 'too_many_parameters',
          severity,
          filePath,
          lineNumber: func.startLine,
          functionName: func.name,
          description: `Too many parameters: ${funcMetrics.parameterCount}`,
          value: funcMetrics.parameterCount,
          threshold: this.thresholds.parameterCount[severity],
          suggestion:
            'Consider using an object parameter or configuration class'
        })
      }

      // Check nesting depth
      if (funcMetrics.nestingDepth > this.thresholds.nestingDepth.low) {
        const severity = this.getSeverity(
          funcMetrics.nestingDepth,
          this.thresholds.nestingDepth
        )
        issues.push({
          type: 'deep_nesting',
          severity,
          filePath,
          lineNumber: func.startLine,
          functionName: func.name,
          description: `Deep nesting: ${funcMetrics.nestingDepth} levels`,
          value: funcMetrics.nestingDepth,
          threshold: this.thresholds.nestingDepth[severity],
          suggestion:
            'Use early returns, guard clauses, or extract nested logic'
        })
      }
    }

    // Check line length for all lines
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.length > this.thresholds.lineLength.low) {
        const severity = this.getSeverity(
          line.length,
          this.thresholds.lineLength
        )
        issues.push({
          type: 'long_line',
          severity,
          filePath,
          lineNumber: i + 1,
          description: `Long line: ${line.length} characters`,
          value: line.length,
          threshold: this.thresholds.lineLength[severity],
          suggestion:
            'Break long lines into multiple lines or use string interpolation'
        })
      }
    }

    // Check for complex conditions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (this.isComplexCondition(line)) {
        issues.push({
          type: 'complex_condition',
          severity: 'medium',
          filePath,
          lineNumber: i + 1,
          description: 'Complex conditional expression detected',
          value: 1,
          threshold: 0,
          suggestion:
            'Extract complex conditions into well-named variables or functions'
        })
      }
    }

    return {issues, metrics}
  }

  private extractFunctions(
    content: string,
    lines: string[]
  ): Array<{
    name: string
    startLine: number
    endLine: number
    content: string
  }> {
    const functions: Array<{
      name: string
      startLine: number
      endLine: number
      content: string
    }> = []

    // JavaScript/TypeScript function patterns
    const functionPatterns = [
      /function\s+(\w+)\s*\(/g,
      /const\s+(\w+)\s*=\s*\(/g,
      /const\s+(\w+)\s*=\s*(?:async\s+)?\(/g,
      /(\w+)\s*:\s*function\s*\(/g,
      /(\w+)\s*=\s*function\s*\(/g,
      /async\s+function\s+(\w+)\s*\(/g,
      /class\s+(\w+)/g,
      /(\w+)\s*\([^)]*\)\s*{/g, // Method
      /(\w+)\s*\([^)]*\)\s*=>/g // Arrow function
    ]

    for (const pattern of functionPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const name = match[1]
        const startIndex = match.index
        const startLine = content.substring(0, startIndex).split('\n').length

        // Find function end (simplified - just look for closing brace)
        let braceCount = 0
        let endIndex = startIndex
        let inFunction = false

        for (let i = startIndex; i < content.length; i++) {
          if (content[i] === '{') {
            braceCount++
            inFunction = true
          } else if (content[i] === '}') {
            braceCount--
            if (inFunction && braceCount === 0) {
              endIndex = i
              break
            }
          }
        }

        const endLine = content.substring(0, endIndex).split('\n').length
        const functionContent = content.substring(startIndex, endIndex + 1)

        functions.push({
          name,
          startLine,
          endLine,
          content: functionContent
        })
      }
    }

    return functions
  }

  private calculateFunctionMetrics(
    func: {name: string; startLine: number; endLine: number; content: string},
    lines: string[]
  ): ComplexityMetrics {
    const content = func.content
    const functionLines = content.split('\n')

    // Cyclomatic complexity calculation
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content)

    // Cognitive complexity calculation
    const cognitiveComplexity = this.calculateCognitiveComplexity(content)

    // Nesting depth
    const nestingDepth = this.calculateNestingDepth(content)

    // Function length (excluding empty lines and comments)
    const functionLength = functionLines.filter(
      line =>
        line.trim() !== '' &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('/*')
    ).length

    // Parameter count
    const parameterCount = this.countParameters(content)

    // Average line length for this function
    const lineLength =
      functionLines.reduce((sum, line) => sum + line.length, 0) /
      functionLines.length

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      nestingDepth,
      functionLength,
      parameterCount,
      lineLength
    }
  }

  private calculateCyclomaticComplexity(content: string): number {
    let complexity = 1 // Base complexity

    // Decision points that increase complexity
    const decisionPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\belif\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bdo\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\b&&\b/g,
      /\b\|\|\b/g,
      /\?\s*:/g,
      /\bthrow\b/g
    ]

    for (const pattern of decisionPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        complexity += matches.length
      }
    }

    return complexity
  }

  private calculateCognitiveComplexity(content: string): number {
    let complexity = 0
    let nestingLevel = 0
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Ignore comments and empty lines
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed === ''
      ) {
        continue
      }

      // Increase nesting
      if (/\b(if|while|for|catch|switch|case)\b/.test(trimmed)) {
        nestingLevel++
        complexity += nestingLevel
      }
      // Decrease nesting
      else if (trimmed === '}' || trimmed === '});' || trimmed === '});') {
        nestingLevel = Math.max(0, nestingLevel - 1)
      }
      // Binary operators increase complexity
      else if (/\b(&&|\|\||and|or)\b/.test(trimmed)) {
        complexity += 1 + nestingLevel
      }
      // Ternary operator
      else if (/\?\s*:/.test(trimmed)) {
        complexity += 1 + nestingLevel
      }
      // Break, continue, goto
      else if (/\b(break|continue|goto)\b/.test(trimmed)) {
        complexity += 1
      }
      // Recursion
      else if (
        new RegExp(
          `\\b${content.match(/function\s+(\w+)/)?.[1] || ''}\\s*\\(`
        ).test(trimmed)
      ) {
        complexity += 1
      }
    }

    return complexity
  }

  private calculateNestingDepth(content: string): number {
    let maxDepth = 0
    let currentDepth = 0
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Ignore comments and empty lines
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed === ''
      ) {
        continue
      }

      // Count opening braces
      const openBraces = (trimmed.match(/{/g) || []).length
      currentDepth += openBraces

      // Count closing braces
      const closeBraces = (trimmed.match(/}/g) || []).length
      currentDepth = Math.max(0, currentDepth - closeBraces)

      maxDepth = Math.max(maxDepth, currentDepth)
    }

    return maxDepth
  }

  private countParameters(content: string): number {
    const match = content.match(/\(([^)]*)\)/)
    if (!match) return 0

    const params = match[1].split(',').filter(p => p.trim() !== '')
    return params.length
  }

  private isComplexCondition(line: string): boolean {
    const trimmed = line.trim()

    // Multiple logical operators in one line
    const logicalOperators = (trimmed.match(/&&|\|\||and|or/g) || []).length
    if (logicalOperators >= 3) return true

    // Nested ternary operators
    if ((trimmed.match(/\?\s*:/g) || []).length >= 2) return true

    // Multiple comparisons in one condition
    const comparisons = (trimmed.match(/[=<>!]=?/g) || []).length
    if (comparisons >= 3) return true

    return false
  }

  private getSeverity(
    value: number,
    thresholds: {low: number; medium: number; high: number; critical: number}
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (value >= thresholds.critical) return 'critical'
    if (value >= thresholds.high) return 'high'
    if (value >= thresholds.medium) return 'medium'
    return 'low'
  }

  private generateComplexityResult(
    issues: ComplexityIssue[],
    metrics: ComplexityMetrics[]
  ): ComplexityAnalysisResult {
    const summary = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }

    const metricsSummary = {
      totalFunctions: metrics.length,
      averageComplexity:
        metrics.length > 0
          ? metrics.reduce((sum, m) => sum + m.cyclomaticComplexity, 0) /
            metrics.length
          : 0,
      maxComplexity:
        metrics.length > 0
          ? Math.max(...metrics.map(m => m.cyclomaticComplexity))
          : 0,
      averageCognitive:
        metrics.length > 0
          ? metrics.reduce((sum, m) => sum + m.cognitiveComplexity, 0) /
            metrics.length
          : 0,
      maxCognitive:
        metrics.length > 0
          ? Math.max(...metrics.map(m => m.cognitiveComplexity))
          : 0,
      averageNesting:
        metrics.length > 0
          ? metrics.reduce((sum, m) => sum + m.nestingDepth, 0) / metrics.length
          : 0,
      maxNesting:
        metrics.length > 0 ? Math.max(...metrics.map(m => m.nestingDepth)) : 0
    }

    const recommendations = this.generateRecommendations(issues)
    const overallScore = this.calculateComplexityScore(issues, metricsSummary)

    return {
      issues,
      summary,
      metrics: metricsSummary,
      recommendations,
      overallScore
    }
  }

  private generateRecommendations(issues: ComplexityIssue[]): string[] {
    const recommendations: string[] = []

    if (this.hasIssueType(issues, 'high_cyclomatic')) {
      recommendations.push(
        '🔄 Reduce cyclomatic complexity by extracting methods and reducing conditional logic'
      )
    }

    if (this.hasIssueType(issues, 'high_cognitive')) {
      recommendations.push(
        '🧠 Simplify cognitive complexity using early returns and guard clauses'
      )
    }

    if (this.hasIssueType(issues, 'large_function')) {
      recommendations.push(
        '📦 Break down large functions into smaller, single-purpose functions'
      )
    }

    if (this.hasIssueType(issues, 'too_many_parameters')) {
      recommendations.push(
        '📋 Reduce parameter count using objects or configuration classes'
      )
    }

    if (this.hasIssueType(issues, 'deep_nesting')) {
      recommendations.push(
        '📊 Reduce nesting depth with early returns and strategy pattern'
      )
    }

    if (this.hasIssueType(issues, 'complex_condition')) {
      recommendations.push(
        '🔍 Extract complex conditions into well-named variables or functions'
      )
    }

    if (this.hasIssueType(issues, 'long_line')) {
      recommendations.push(
        '📝 Break long lines and follow consistent line length guidelines'
      )
    }

    // General recommendations
    if (issues.length > 0) {
      recommendations.push(
        '📚 Follow SOLID principles for better code organization'
      )
      recommendations.push(
        '🔧 Consider using refactoring tools to identify improvement opportunities'
      )
      recommendations.push(
        '📈 Set up automated complexity monitoring in your CI/CD pipeline'
      )
    }

    return recommendations
  }

  private hasIssueType(
    issues: ComplexityIssue[],
    type: ComplexityIssue['type']
  ): boolean {
    return issues.some(i => i.type === type)
  }

  private calculateComplexityScore(
    issues: ComplexityIssue[],
    metrics: any
  ): number {
    if (issues.length === 0) return 100

    const severityWeights = {
      critical: 30,
      high: 15,
      medium: 8,
      low: 3
    }

    // Base score from metrics
    let score = 100

    // Deduct for issues
    const totalDeduction = issues.reduce((sum, issue) => {
      return sum + severityWeights[issue.severity]
    }, 0)

    // Additional deduction for high average complexity
    if (metrics.averageComplexity > 15) {
      score -= 10
    } else if (metrics.averageComplexity > 10) {
      score -= 5
    }

    // Additional deduction for high max complexity
    if (metrics.maxComplexity > 30) {
      score -= 15
    } else if (metrics.maxComplexity > 20) {
      score -= 8
    }

    return Math.max(0, score - totalDeduction)
  }

  generateComplexityComment(result: ComplexityAnalysisResult): string {
    let comment = `## 📊 Code Complexity Metrics\n\n`

    const totalIssues =
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low

    if (totalIssues === 0) {
      comment += `✅ **No complexity issues detected** in the changed files.\n\n`
      comment += `### 📈 Complexity Score: ${result.overallScore}/100\n\n`
      comment += `### 📋 Metrics Summary\n\n`
      comment += `- **Functions Analyzed**: ${result.metrics.totalFunctions}\n`
      comment += `- **Average Cyclomatic Complexity**: ${result.metrics.averageComplexity.toFixed(
        1
      )}\n`
      comment += `- **Max Cyclomatic Complexity**: ${result.metrics.maxComplexity}\n`
      comment += `- **Average Cognitive Complexity**: ${result.metrics.averageCognitive.toFixed(
        1
      )}\n`
      comment += `- **Max Cognitive Complexity**: ${result.metrics.maxCognitive}\n\n`
      comment += `### 💡 Complexity Best Practices\n\n`
      comment += `- Keep functions small and focused\n`
      comment += `- Minimize nesting and conditional complexity\n`
      comment += `- Use descriptive names and clear structure\n`
      return comment
    }

    comment += `📈 **Complexity Score: ${result.overallScore}/100**\n\n`
    comment += `⚠️ **${totalIssues} complexity issues found**\n\n`

    comment += `### 📊 Severity Breakdown\n\n`
    comment += `- 🔴 **Critical**: ${result.summary.critical}\n`
    comment += `- 🟠 **High**: ${result.summary.high}\n`
    comment += `- 🟡 **Medium**: ${result.summary.medium}\n`
    comment += `- 🟢 **Low**: ${result.summary.low}\n\n`

    comment += `### 📋 Metrics Summary\n\n`
    comment += `- **Functions Analyzed**: ${result.metrics.totalFunctions}\n`
    comment += `- **Average Cyclomatic Complexity**: ${result.metrics.averageComplexity.toFixed(
      1
    )}\n`
    comment += `- **Max Cyclomatic Complexity**: ${result.metrics.maxComplexity}\n`
    comment += `- **Average Cognitive Complexity**: ${result.metrics.averageCognitive.toFixed(
      1
    )}\n`
    comment += `- **Max Cognitive Complexity**: ${result.metrics.maxCognitive}\n`
    comment += `- **Average Nesting Depth**: ${result.metrics.averageNesting.toFixed(
      1
    )}\n`
    comment += `- **Max Nesting Depth**: ${result.metrics.maxNesting}\n\n`

    // Group issues by severity
    const criticalIssues = result.issues.filter(i => i.severity === 'critical')
    const highIssues = result.issues.filter(i => i.severity === 'high')

    if (criticalIssues.length > 0) {
      comment += `### 🔴 Critical Complexity Issues\n\n`
      for (const issue of criticalIssues.slice(0, 3)) {
        comment += `- **${
          issue.functionName ? `${issue.functionName}() at ` : ''
        }${issue.filePath}:${issue.lineNumber}** - ${issue.description}\n`
        comment += `  - **Value**: ${issue.value} (threshold: ${issue.threshold})\n`
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
        comment += `- **${
          issue.functionName ? `${issue.functionName}() at ` : ''
        }${issue.filePath}:${issue.lineNumber}** - ${issue.description}\n`
        comment += `  - **Value**: ${issue.value} (threshold: ${issue.threshold})\n`
        comment += `  - **Suggestion**: ${issue.suggestion}\n\n`
      }
      if (highIssues.length > 3) {
        comment += `- ... and ${
          highIssues.length - 3
        } more high severity issues\n\n`
      }
    }

    if (result.recommendations.length > 0) {
      comment += `### 💡 Complexity Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    return comment
  }
}
