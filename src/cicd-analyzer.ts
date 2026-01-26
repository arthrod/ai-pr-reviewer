import {info, warning, setFailed, setOutput} from '@actions/core'

export interface CICDIssue {
  type:
    | 'merge_block'
    | 'quality_gate'
    | 'security_gate'
    | 'performance_gate'
    | 'coverage_gate'
    | 'complexity_gate'
    | 'dependency_gate'
    | 'documentation_gate'
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'blocker' | 'warning' | 'info'
  metric: string
  value: number
  threshold: number
  description: string
  recommendation: string
  blockMerge: boolean
}

export interface CICDMetrics {
  testCoverageScore: number
  securityScore: number
  performanceScore: number
  complexityScore: number
  dependencyScore: number
  documentationScore: number
  overallQualityScore: number
}

export interface CICDAnalysisResult {
  issues: CICDIssue[]
  summary: {
    blockers: number
    warnings: number
    info: number
    totalIssues: number
  }
  metrics: CICDMetrics
  mergeBlocked: boolean
  recommendations: string[]
  gateStatus: {
    quality: 'pass' | 'fail' | 'warning'
    security: 'pass' | 'fail' | 'warning'
    performance: 'pass' | 'fail' | 'warning'
    coverage: 'pass' | 'fail' | 'warning'
    complexity: 'pass' | 'fail' | 'warning'
    dependency: 'pass' | 'fail' | 'warning'
    documentation: 'pass' | 'fail' | 'warning'
  }
}

export class CICDAnalyzer {
  private readonly gateThresholds = {
    testCoverage: {
      blocker: 60,
      warning: 80
    },
    security: {
      blocker: 70,
      warning: 85
    },
    performance: {
      blocker: 50,
      warning: 70
    },
    complexity: {
      blocker: 60,
      warning: 75
    },
    dependency: {
      blocker: 65,
      warning: 80
    },
    documentation: {
      blocker: 50,
      warning: 70
    },
    overallQuality: {
      blocker: 65,
      warning: 80
    }
  }

  async analyzeCICD(
    testCoverageScore: number,
    securityScore: number,
    performanceScore: number,
    complexityScore: number,
    dependencyScore: number,
    documentationScore: number,
    options: {
      enableMergeBlocking: boolean
      strictMode: boolean
      qualityGateThreshold: number
      securityGateThreshold: number
      performanceGateThreshold: number
      coverageGateThreshold: number
      complexityGateThreshold: number
      dependencyGateThreshold: number
      documentationGateThreshold: number
    }
  ): Promise<CICDAnalysisResult> {
    const issues: CICDIssue[] = []
    const metrics: CICDMetrics = {
      testCoverageScore,
      securityScore,
      performanceScore,
      complexityScore,
      dependencyScore,
      documentationScore,
      overallQualityScore: this.calculateOverallQualityScore(
        testCoverageScore,
        securityScore,
        performanceScore,
        complexityScore,
        dependencyScore,
        documentationScore
      )
    }

    // Check each gate
    const gateStatus = {
      quality: this.checkQualityGate(
        metrics.overallQualityScore,
        options.qualityGateThreshold,
        options.strictMode
      ),
      security: this.checkSecurityGate(
        metrics.securityScore,
        options.securityGateThreshold,
        options.strictMode
      ),
      performance: this.checkPerformanceGate(
        metrics.performanceScore,
        options.performanceGateThreshold,
        options.strictMode
      ),
      coverage: this.checkCoverageGate(
        metrics.testCoverageScore,
        options.coverageGateThreshold,
        options.strictMode
      ),
      complexity: this.checkComplexityGate(
        metrics.complexityScore,
        options.complexityGateThreshold,
        options.strictMode
      ),
      dependency: this.checkDependencyGate(
        metrics.dependencyScore,
        options.dependencyGateThreshold,
        options.strictMode
      ),
      documentation: this.checkDocumentationGate(
        metrics.documentationScore,
        options.documentationGateThreshold,
        options.strictMode
      )
    }

    // Generate issues based on gate failures
    issues.push(...this.generateGateIssues(metrics, gateStatus, options))

    const summary = {
      blockers: issues.filter(i => i.category === 'blocker').length,
      warnings: issues.filter(i => i.category === 'warning').length,
      info: issues.filter(i => i.category === 'info').length,
      totalIssues: issues.length
    }

    const mergeBlocked = options.enableMergeBlocking && summary.blockers > 0
    const recommendations = this.generateRecommendations(
      issues,
      metrics,
      gateStatus
    )

    // Set GitHub Actions outputs
    this.setOutputs(metrics, gateStatus, mergeBlocked, summary)

    // Fail the build if there are blockers and merge blocking is enabled
    if (mergeBlocked) {
      setFailed(
        `PR blocked from merge due to ${summary.blockers} critical issues`
      )
    }

    return {
      issues,
      summary,
      metrics,
      mergeBlocked,
      recommendations,
      gateStatus
    }
  }

  private calculateOverallQualityScore(
    testCoverage: number,
    security: number,
    performance: number,
    complexity: number,
    dependency: number,
    documentation: number
  ): number {
    // Weighted average of all scores
    const weights = {
      testCoverage: 0.2,
      security: 0.25,
      performance: 0.15,
      complexity: 0.15,
      dependency: 0.15,
      documentation: 0.1
    }

    const weightedSum =
      testCoverage * weights.testCoverage +
      security * weights.security +
      performance * weights.performance +
      complexity * weights.complexity +
      dependency * weights.dependency +
      documentation * weights.documentation

    return Math.round(weightedSum)
  }

  private checkQualityGate(
    score: number,
    threshold: number,
    strictMode: boolean
  ): 'pass' | 'fail' | 'warning' {
    const actualThreshold = strictMode ? threshold + 10 : threshold

    if (score < this.gateThresholds.overallQuality.blocker) {
      return 'fail'
    } else if (score < actualThreshold) {
      return 'warning'
    }
    return 'pass'
  }

  private checkSecurityGate(
    score: number,
    threshold: number,
    strictMode: boolean
  ): 'pass' | 'fail' | 'warning' {
    const actualThreshold = strictMode ? threshold + 10 : threshold

    if (score < this.gateThresholds.security.blocker) {
      return 'fail'
    } else if (score < actualThreshold) {
      return 'warning'
    }
    return 'pass'
  }

  private checkPerformanceGate(
    score: number,
    threshold: number,
    strictMode: boolean
  ): 'pass' | 'fail' | 'warning' {
    const actualThreshold = strictMode ? threshold + 10 : threshold

    if (score < this.gateThresholds.performance.blocker) {
      return 'fail'
    } else if (score < actualThreshold) {
      return 'warning'
    }
    return 'pass'
  }

  private checkCoverageGate(
    score: number,
    threshold: number,
    strictMode: boolean
  ): 'pass' | 'fail' | 'warning' {
    const actualThreshold = strictMode ? threshold + 10 : threshold

    if (score < this.gateThresholds.testCoverage.blocker) {
      return 'fail'
    } else if (score < actualThreshold) {
      return 'warning'
    }
    return 'pass'
  }

  private checkComplexityGate(
    score: number,
    threshold: number,
    strictMode: boolean
  ): 'pass' | 'fail' | 'warning' {
    const actualThreshold = strictMode ? threshold + 10 : threshold

    if (score < this.gateThresholds.complexity.blocker) {
      return 'fail'
    } else if (score < actualThreshold) {
      return 'warning'
    }
    return 'pass'
  }

  private checkDependencyGate(
    score: number,
    threshold: number,
    strictMode: boolean
  ): 'pass' | 'fail' | 'warning' {
    const actualThreshold = strictMode ? threshold + 10 : threshold

    if (score < this.gateThresholds.dependency.blocker) {
      return 'fail'
    } else if (score < actualThreshold) {
      return 'warning'
    }
    return 'pass'
  }

  private checkDocumentationGate(
    score: number,
    threshold: number,
    strictMode: boolean
  ): 'pass' | 'fail' | 'warning' {
    const actualThreshold = strictMode ? threshold + 10 : threshold

    if (score < this.gateThresholds.documentation.blocker) {
      return 'fail'
    } else if (score < actualThreshold) {
      return 'warning'
    }
    return 'pass'
  }

  private generateGateIssues(
    metrics: CICDMetrics,
    gateStatus: CICDAnalysisResult['gateStatus'],
    options: {
      enableMergeBlocking: boolean
      strictMode: boolean
      qualityGateThreshold: number
      securityGateThreshold: number
      performanceGateThreshold: number
      coverageGateThreshold: number
      complexityGateThreshold: number
      dependencyGateThreshold: number
      documentationGateThreshold: number
    }
  ): CICDIssue[] {
    const issues: CICDIssue[] = []

    // Quality gate issues
    if (gateStatus.quality === 'fail') {
      issues.push({
        type: 'quality_gate',
        severity: 'critical',
        category: 'blocker',
        metric: 'overall_quality_score',
        value: metrics.overallQualityScore,
        threshold: this.gateThresholds.overallQuality.blocker,
        description: `Overall quality score (${metrics.overallQualityScore}) below minimum threshold`,
        recommendation:
          'Improve code quality across all metrics before merging',
        blockMerge: options.enableMergeBlocking
      })
    } else if (gateStatus.quality === 'warning') {
      issues.push({
        type: 'quality_gate',
        severity: 'medium',
        category: 'warning',
        metric: 'overall_quality_score',
        value: metrics.overallQualityScore,
        threshold: options.qualityGateThreshold,
        description: `Overall quality score (${metrics.overallQualityScore}) below desired threshold`,
        recommendation: 'Consider improving code quality before merging',
        blockMerge: false
      })
    }

    // Security gate issues
    if (gateStatus.security === 'fail') {
      issues.push({
        type: 'security_gate',
        severity: 'critical',
        category: 'blocker',
        metric: 'security_score',
        value: metrics.securityScore,
        threshold: this.gateThresholds.security.blocker,
        description: `Security score (${metrics.securityScore}) below minimum threshold`,
        recommendation: 'Address security vulnerabilities before merging',
        blockMerge: options.enableMergeBlocking
      })
    } else if (gateStatus.security === 'warning') {
      issues.push({
        type: 'security_gate',
        severity: 'high',
        category: 'warning',
        metric: 'security_score',
        value: metrics.securityScore,
        threshold: options.securityGateThreshold,
        description: `Security score (${metrics.securityScore}) below desired threshold`,
        recommendation: 'Review and address security concerns',
        blockMerge: false
      })
    }

    // Performance gate issues
    if (gateStatus.performance === 'fail') {
      issues.push({
        type: 'performance_gate',
        severity: 'high',
        category: 'blocker',
        metric: 'performance_score',
        value: metrics.performanceScore,
        threshold: this.gateThresholds.performance.blocker,
        description: `Performance score (${metrics.performanceScore}) below minimum threshold`,
        recommendation: 'Optimize performance before merging',
        blockMerge: options.enableMergeBlocking
      })
    } else if (gateStatus.performance === 'warning') {
      issues.push({
        type: 'performance_gate',
        severity: 'medium',
        category: 'warning',
        metric: 'performance_score',
        value: metrics.performanceScore,
        threshold: options.performanceGateThreshold,
        description: `Performance score (${metrics.performanceScore}) below desired threshold`,
        recommendation: 'Consider performance optimizations',
        blockMerge: false
      })
    }

    // Coverage gate issues
    if (gateStatus.coverage === 'fail') {
      issues.push({
        type: 'coverage_gate',
        severity: 'high',
        category: 'blocker',
        metric: 'test_coverage_score',
        value: metrics.testCoverageScore,
        threshold: this.gateThresholds.testCoverage.blocker,
        description: `Test coverage score (${metrics.testCoverageScore}) below minimum threshold`,
        recommendation: 'Increase test coverage before merging',
        blockMerge: options.enableMergeBlocking
      })
    } else if (gateStatus.coverage === 'warning') {
      issues.push({
        type: 'coverage_gate',
        severity: 'medium',
        category: 'warning',
        metric: 'test_coverage_score',
        value: metrics.testCoverageScore,
        threshold: options.coverageGateThreshold,
        description: `Test coverage score (${metrics.testCoverageScore}) below desired threshold`,
        recommendation: 'Consider adding more tests',
        blockMerge: false
      })
    }

    // Complexity gate issues
    if (gateStatus.complexity === 'fail') {
      issues.push({
        type: 'complexity_gate',
        severity: 'high',
        category: 'blocker',
        metric: 'complexity_score',
        value: metrics.complexityScore,
        threshold: this.gateThresholds.complexity.blocker,
        description: `Complexity score (${metrics.complexityScore}) below minimum threshold`,
        recommendation: 'Reduce code complexity before merging',
        blockMerge: options.enableMergeBlocking
      })
    } else if (gateStatus.complexity === 'warning') {
      issues.push({
        type: 'complexity_gate',
        severity: 'medium',
        category: 'warning',
        metric: 'complexity_score',
        value: metrics.complexityScore,
        threshold: options.complexityGateThreshold,
        description: `Complexity score (${metrics.complexityScore}) below desired threshold`,
        recommendation: 'Consider refactoring complex code',
        blockMerge: false
      })
    }

    // Dependency gate issues
    if (gateStatus.dependency === 'fail') {
      issues.push({
        type: 'dependency_gate',
        severity: 'high',
        category: 'blocker',
        metric: 'dependency_score',
        value: metrics.dependencyScore,
        threshold: this.gateThresholds.dependency.blocker,
        description: `Dependency security score (${metrics.dependencyScore}) below minimum threshold`,
        recommendation: 'Update dependencies and address security issues',
        blockMerge: options.enableMergeBlocking
      })
    } else if (gateStatus.dependency === 'warning') {
      issues.push({
        type: 'dependency_gate',
        severity: 'medium',
        category: 'warning',
        metric: 'dependency_score',
        value: metrics.dependencyScore,
        threshold: options.dependencyGateThreshold,
        description: `Dependency security score (${metrics.dependencyScore}) below desired threshold`,
        recommendation: 'Review and update dependencies',
        blockMerge: false
      })
    }

    // Documentation gate issues
    if (gateStatus.documentation === 'fail') {
      issues.push({
        type: 'documentation_gate',
        severity: 'medium',
        category: 'blocker',
        metric: 'documentation_score',
        value: metrics.documentationScore,
        threshold: this.gateThresholds.documentation.blocker,
        description: `Documentation coverage score (${metrics.documentationScore}) below minimum threshold`,
        recommendation: 'Improve documentation before merging',
        blockMerge: options.enableMergeBlocking
      })
    } else if (gateStatus.documentation === 'warning') {
      issues.push({
        type: 'documentation_gate',
        severity: 'low',
        category: 'warning',
        metric: 'documentation_score',
        value: metrics.documentationScore,
        threshold: options.documentationGateThreshold,
        description: `Documentation coverage score (${metrics.documentationScore}) below desired threshold`,
        recommendation: 'Consider improving documentation',
        blockMerge: false
      })
    }

    return issues
  }

  private setOutputs(
    metrics: CICDMetrics,
    gateStatus: CICDAnalysisResult['gateStatus'],
    mergeBlocked: boolean,
    summary: CICDAnalysisResult['summary']
  ): void {
    // Set GitHub Actions outputs for use in workflows
    setOutput('test_coverage_score', metrics.testCoverageScore.toString())
    setOutput('security_score', metrics.securityScore.toString())
    setOutput('performance_score', metrics.performanceScore.toString())
    setOutput('complexity_score', metrics.complexityScore.toString())
    setOutput('dependency_score', metrics.dependencyScore.toString())
    setOutput('documentation_score', metrics.documentationScore.toString())
    setOutput('overall_quality_score', metrics.overallQualityScore.toString())

    setOutput('quality_gate_status', gateStatus.quality)
    setOutput('security_gate_status', gateStatus.security)
    setOutput('performance_gate_status', gateStatus.performance)
    setOutput('coverage_gate_status', gateStatus.coverage)
    setOutput('complexity_gate_status', gateStatus.complexity)
    setOutput('dependency_gate_status', gateStatus.dependency)
    setOutput('documentation_gate_status', gateStatus.documentation)

    setOutput('merge_blocked', mergeBlocked.toString())
    setOutput('total_issues', summary.totalIssues.toString())
    setOutput('blockers', summary.blockers.toString())
    setOutput('warnings', summary.warnings.toString())
    setOutput('info', summary.info.toString())
  }

  private generateRecommendations(
    issues: CICDIssue[],
    metrics: CICDMetrics,
    gateStatus: CICDAnalysisResult['gateStatus']
  ): string[] {
    const recommendations: string[] = []

    if (gateStatus.quality === 'fail') {
      recommendations.push(
        '🚫 **CRITICAL**: Overall quality gate failed - address all critical issues before merging'
      )
    } else if (gateStatus.quality === 'warning') {
      recommendations.push(
        '⚠️ **WARNING**: Quality gate warning - consider improvements before merging'
      )
    }

    if (gateStatus.security === 'fail') {
      recommendations.push(
        '🔒 **CRITICAL**: Security gate failed - fix all security vulnerabilities immediately'
      )
    } else if (gateStatus.security === 'warning') {
      recommendations.push(
        '🔐 **WARNING**: Security concerns detected - review and address security issues'
      )
    }

    if (gateStatus.performance === 'fail') {
      recommendations.push(
        '⚡ **CRITICAL**: Performance gate failed - optimize code performance before merging'
      )
    } else if (gateStatus.performance === 'warning') {
      recommendations.push(
        '📈 **WARNING**: Performance issues detected - consider optimizations'
      )
    }

    if (gateStatus.coverage === 'fail') {
      recommendations.push(
        '🧪 **CRITICAL**: Test coverage gate failed - add more tests to meet minimum coverage'
      )
    } else if (gateStatus.coverage === 'warning') {
      recommendations.push(
        '📋 **WARNING**: Low test coverage - consider adding more tests'
      )
    }

    if (gateStatus.complexity === 'fail') {
      recommendations.push(
        '🔀 **CRITICAL**: Complexity gate failed - refactor complex code before merging'
      )
    } else if (gateStatus.complexity === 'warning') {
      recommendations.push(
        '📊 **WARNING**: High complexity detected - consider refactoring'
      )
    }

    if (gateStatus.dependency === 'fail') {
      recommendations.push(
        '📦 **CRITICAL**: Dependency gate failed - update dependencies and fix security issues'
      )
    } else if (gateStatus.dependency === 'warning') {
      recommendations.push(
        '🔄 **WARNING**: Dependency issues detected - review and update dependencies'
      )
    }

    if (gateStatus.documentation === 'fail') {
      recommendations.push(
        '📚 **CRITICAL**: Documentation gate failed - improve documentation before merging'
      )
    } else if (gateStatus.documentation === 'warning') {
      recommendations.push(
        '📖 **WARNING**: Documentation issues detected - consider improving documentation'
      )
    }

    // General recommendations
    if (issues.some(i => i.category === 'blocker')) {
      recommendations.push(
        '🚫 **MERGE BLOCKED**: Address all critical issues to enable merge'
      )
    }

    if (issues.length > 0) {
      recommendations.push(
        '📊 **Quality Metrics**: Review detailed analysis results for specific improvement areas'
      )
      recommendations.push(
        '🔄 **Continuous Improvement**: Use these insights to improve future PRs'
      )
    }

    return recommendations
  }

  generateCICDComment(result: CICDAnalysisResult): string {
    let comment = `## 🚀 CI/CD Pipeline Integration\n\n`

    if (result.mergeBlocked) {
      comment += `🚫 **MERGE BLOCKED** - ${result.summary.blockers} critical issues must be resolved\n\n`
    } else if (result.summary.warnings > 0) {
      comment += `⚠️ **MERGE ALLOWED** - ${result.summary.warnings} warnings detected\n\n`
    } else {
      comment += `✅ **MERGE APPROVED** - All quality gates passed\n\n`
    }

    comment += `### 📊 Quality Gate Status\n\n`

    const gateEmojis = {
      pass: '✅',
      warning: '⚠️',
      fail: '❌'
    }

    comment += `- **Overall Quality**: ${
      gateEmojis[result.gateStatus.quality]
    } ${result.gateStatus.quality.toUpperCase()} (${
      result.metrics.overallQualityScore
    }/100)\n`
    comment += `- **Security**: ${
      gateEmojis[result.gateStatus.security]
    } ${result.gateStatus.security.toUpperCase()} (${
      result.metrics.securityScore
    }/100)\n`
    comment += `- **Performance**: ${
      gateEmojis[result.gateStatus.performance]
    } ${result.gateStatus.performance.toUpperCase()} (${
      result.metrics.performanceScore
    }/100)\n`
    comment += `- **Test Coverage**: ${
      gateEmojis[result.gateStatus.coverage]
    } ${result.gateStatus.coverage.toUpperCase()} (${
      result.metrics.testCoverageScore
    }/100)\n`
    comment += `- **Complexity**: ${
      gateEmojis[result.gateStatus.complexity]
    } ${result.gateStatus.complexity.toUpperCase()} (${
      result.metrics.complexityScore
    }/100)\n`
    comment += `- **Dependencies**: ${
      gateEmojis[result.gateStatus.dependency]
    } ${result.gateStatus.dependency.toUpperCase()} (${
      result.metrics.dependencyScore
    }/100)\n`
    comment += `- **Documentation**: ${
      gateEmojis[result.gateStatus.documentation]
    } ${result.gateStatus.documentation.toUpperCase()} (${
      result.metrics.documentationScore
    }/100)\n\n`

    if (result.summary.totalIssues > 0) {
      comment += `### 📋 Issues Summary\n\n`
      comment += `- **Blockers**: ${result.summary.blockers}\n`
      comment += `- **Warnings**: ${result.summary.warnings}\n`
      comment += `- **Info**: ${result.summary.info}\n`
      comment += `- **Total**: ${result.summary.totalIssues}\n\n`

      // Show blockers first
      const blockers = result.issues.filter(i => i.category === 'blocker')
      if (blockers.length > 0) {
        comment += `### 🚫 Critical Issues (Blockers)\n\n`
        for (const issue of blockers) {
          comment += `- **${issue.metric}**: ${issue.description}\n`
          comment += `  - **Current**: ${issue.value}/100\n`
          comment += `  - **Required**: ${issue.threshold}/100\n`
          comment += `  - **Action**: ${issue.recommendation}\n\n`
        }
      }

      // Show warnings
      const warnings = result.issues.filter(i => i.category === 'warning')
      if (warnings.length > 0) {
        comment += `### ⚠️ Warnings\n\n`
        for (const issue of warnings.slice(0, 5)) {
          // Limit to 5 for readability
          comment += `- **${issue.metric}**: ${issue.description}\n`
          comment += `  - **Current**: ${issue.value}/100\n`
          comment += `  - **Recommended**: ${issue.threshold}/100\n\n`
        }
        if (warnings.length > 5) {
          comment += `- ... and ${warnings.length - 5} more warnings\n\n`
        }
      }
    }

    if (result.recommendations.length > 0) {
      comment += `### 💡 Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    comment += `### 🔧 CI/CD Integration\n\n`
    comment += `This analysis is integrated into your CI/CD pipeline with the following features:\n\n`
    comment += `- **Quality Gates**: Automatic enforcement of code quality standards\n`
    comment += `- **Merge Blocking**: Prevents merging of PRs that don't meet quality criteria\n`
    comment += `- **Real-time Feedback**: Immediate analysis during pull request creation\n`
    comment += `- **Metrics Tracking**: Continuous monitoring of code quality metrics\n`
    comment += `- **Automated Outputs**: GitHub Actions outputs for workflow integration\n\n`

    if (result.mergeBlocked) {
      comment += `### 🚫 Next Steps\n\n`
      comment += `1. Address all critical issues listed above\n`
      comment += `2. Push fixes to the pull request branch\n`
      comment += `3. Wait for automated re-analysis\n`
      comment += `4. Merge once all gates pass\n\n`
    }

    return comment
  }
}
