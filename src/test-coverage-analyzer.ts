import {info, warning} from '@actions/core'
import {octokit} from './octokit'
// eslint-disable-next-line camelcase
import {context as github_context} from '@actions/github'

const context = github_context
const repo = context.repo

export interface TestCoverageResult {
  filePath: string
  coveragePercentage: number
  missingLines: number[]
  suggestedTests: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

export interface TestCoverageSummary {
  totalFiles: number
  averageCoverage: number
  highRiskFiles: TestCoverageResult[]
  recommendations: string[]
}

export class TestCoverageAnalyzer {
  private readonly coverageThresholds = {
    high: 80,
    medium: 60,
    low: 40
  }

  async analyzeTestCoverage(
    changedFiles: string[]
  ): Promise<TestCoverageSummary> {
    const results: TestCoverageResult[] = []

    for (const filePath of changedFiles) {
      if (this.isCodeFile(filePath)) {
        try {
          const coverage = await this.getFileCoverage(filePath)
          if (coverage) {
            results.push(coverage)
          }
        } catch (error) {
          warning(`Failed to analyze coverage for ${filePath}: ${error}`)
        }
      }
    }

    return this.generateSummary(results)
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.ts',
      '.js',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.cpp',
      '.c',
      '.go',
      '.rs',
      '.php',
      '.rb',
      '.cs'
    ]
    return codeExtensions.some(ext => filePath.endsWith(ext))
  }

  private async getFileCoverage(
    filePath: string
  ): Promise<TestCoverageResult | null> {
    try {
      // Try to get coverage from common coverage report files
      const coverageData = await this.getCoverageData()

      if (!coverageData || !coverageData[filePath]) {
        // If no coverage data exists, suggest creating tests
        return this.createNoCoverageResult(filePath)
      }

      const fileCoverage = coverageData[filePath]
      const missingLines = this.findMissingLines(fileCoverage)
      const suggestedTests = this.generateTestSuggestions(
        filePath,
        missingLines
      )
      const riskLevel = this.calculateRiskLevel(fileCoverage.coverage)

      return {
        filePath,
        coveragePercentage: fileCoverage.coverage,
        missingLines,
        suggestedTests,
        riskLevel
      }
    } catch (error) {
      warning(`Error analyzing coverage for ${filePath}: ${error}`)
      return null
    }
  }

  private async getCoverageData(): Promise<any> {
    try {
      // Try to fetch coverage reports from common locations
      const coverageFiles = [
        'coverage/coverage-summary.json',
        'coverage/lcov.info',
        'coverage/clover.xml',
        'test-results/coverage.json',
        'coverage/coverage.json'
      ]

      for (const coverageFile of coverageFiles) {
        try {
          const {data} = await octokit.repos.getContent({
            owner: repo.owner,
            repo: repo.repo,
            path: coverageFile,
            ref: context.payload.pull_request?.head.sha
          })

          if ('content' in data && data.type === 'file') {
            const content = Buffer.from(data.content, 'base64').toString(
              'utf-8'
            )

            if (coverageFile.endsWith('.json')) {
              return this.parseJsonCoverage(content)
            } else if (coverageFile.endsWith('.info')) {
              return this.parseLcovCoverage(content)
            }
          }
        } catch {
          // Continue to next coverage file
          continue
        }
      }
    } catch (error) {
      warning(`Failed to fetch coverage data: ${error}`)
    }

    return null
  }

  private parseJsonCoverage(content: string): any {
    try {
      const coverage = JSON.parse(content)

      // Handle different coverage report formats
      if (coverage.total && coverage.total.lines) {
        // Istanbul/NYC format
        return this.convertIstanbulToStandard(coverage)
      } else if (coverage.coverageMap) {
        // Jest coverage format
        return this.convertJestToStandard(coverage)
      }

      return coverage
    } catch (error) {
      warning(`Failed to parse JSON coverage: ${error}`)
      return null
    }
  }

  private parseLcovCoverage(content: string): any {
    const coverage: any = {}
    let currentFile = ''

    const lines = content.split('\n')
    for (const line of lines) {
      if (line.startsWith('SF:')) {
        currentFile = line.substring(3)
        coverage[currentFile] = {lines: {}, coverage: 0}
      } else if (line.startsWith('DA:')) {
        const [lineNum, hitCount] = line.substring(3).split(',')
        if (currentFile && coverage[currentFile]) {
          coverage[currentFile].lines[lineNum] = parseInt(hitCount)
        }
      } else if (line.startsWith('end_of_record')) {
        // Calculate coverage percentage for current file
        if (currentFile && coverage[currentFile]) {
          const lines = coverage[currentFile].lines
          const totalLines = Object.keys(lines).length
          const coveredLines = Object.values(lines).filter(
            (hit: any) => hit > 0
          ).length
          coverage[currentFile].coverage =
            totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
        }
      }
    }

    return coverage
  }

  private convertIstanbulToStandard(istanbulCoverage: any): any {
    const standard: any = {}

    if (istanbulCoverage.total && istanbulCoverage.total.lines) {
      // This is summary format, need detailed file data
      return standard
    }

    for (const [filePath, fileData] of Object.entries(istanbulCoverage)) {
      if (
        typeof fileData === 'object' &&
        fileData !== null &&
        's' in fileData
      ) {
        const statements = fileData.s as any
        const totalStatements = statements.length
        const coveredStatements = statements.filter(
          (hit: number) => hit > 0
        ).length

        standard[filePath] = {
          coverage: (coveredStatements / totalStatements) * 100,
          lines: statements
        }
      }
    }

    return standard
  }

  private convertJestToStandard(jestCoverage: any): any {
    const standard: any = {}

    if (jestCoverage.coverageMap) {
      const coverageMap = jestCoverage.coverageMap

      for (const [filePath, fileCoverage] of Object.entries(coverageMap)) {
        if (typeof fileCoverage === 'object' && fileCoverage !== null) {
          const coverage = fileCoverage as any
          const lines = coverage.s || {}
          const totalLines = Object.keys(lines).length
          const coveredLines = Object.values(lines).filter(
            (hit: any) => hit > 0
          ).length

          standard[filePath] = {
            coverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
            lines
          }
        }
      }
    }

    return standard
  }

  private createNoCoverageResult(filePath: string): TestCoverageResult {
    const suggestedTests = this.generateGenericTestSuggestions(filePath)

    return {
      filePath,
      coveragePercentage: 0,
      missingLines: [],
      suggestedTests,
      riskLevel: 'high'
    }
  }

  private findMissingLines(fileCoverage: any): number[] {
    const missingLines: number[] = []

    if (fileCoverage.lines) {
      for (const [lineNum, hitCount] of Object.entries(fileCoverage.lines)) {
        if (hitCount === 0) {
          missingLines.push(parseInt(lineNum))
        }
      }
    }

    return missingLines
  }

  private generateTestSuggestions(
    filePath: string,
    missingLines: number[]
  ): string[] {
    const suggestions: string[] = []
    const fileExtension = filePath.split('.').pop()

    // Basic test file naming suggestions
    const testFileName = filePath.replace(
      new RegExp(`\\.${fileExtension}$`),
      `.test.${fileExtension}`
    )

    suggestions.push(`Create test file: ${testFileName}`)

    // Function-specific suggestions based on file content
    if (missingLines.length > 0) {
      suggestions.push(
        `Add tests for uncovered lines: ${missingLines.slice(0, 5).join(', ')}${
          missingLines.length > 5 ? '...' : ''
        }`
      )
    }

    // Language-specific suggestions
    switch (fileExtension) {
      case 'ts':
      case 'js':
        suggestions.push('Add unit tests for exported functions and classes')
        suggestions.push('Consider using Jest or Mocha for testing framework')
        break
      case 'py':
        suggestions.push('Add unit tests using pytest framework')
        suggestions.push('Test edge cases and error conditions')
        break
      case 'java':
        suggestions.push('Add JUnit tests for public methods')
        suggestions.push('Consider using Mockito for mocking dependencies')
        break
    }

    return suggestions
  }

  private generateGenericTestSuggestions(filePath: string): string[] {
    const fileExtension = filePath.split('.').pop()
    const suggestions: string[] = []

    const testFileName = filePath.replace(
      new RegExp(`\\.${fileExtension}$`),
      `.test.${fileExtension}`
    )

    suggestions.push(`Create test file: ${testFileName}`)
    suggestions.push('Add unit tests for main functionality')
    suggestions.push('Test error handling and edge cases')
    suggestions.push('Add integration tests if applicable')

    return suggestions
  }

  private calculateRiskLevel(coverage: number): 'low' | 'medium' | 'high' {
    if (coverage >= this.coverageThresholds.high) return 'low'
    if (coverage >= this.coverageThresholds.medium) return 'medium'
    return 'high'
  }

  private generateSummary(results: TestCoverageResult[]): TestCoverageSummary {
    const highRiskFiles = results.filter(r => r.riskLevel === 'high')
    const averageCoverage =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.coveragePercentage, 0) /
          results.length
        : 0

    const recommendations: string[] = []

    if (highRiskFiles.length > 0) {
      recommendations.push(
        `🚨 High priority: Improve test coverage for ${highRiskFiles.length} file(s) with low coverage`
      )
    }

    if (averageCoverage < this.coverageThresholds.medium) {
      recommendations.push(
        '📊 Consider implementing a comprehensive testing strategy'
      )
    }

    if (averageCoverage < this.coverageThresholds.high) {
      recommendations.push(
        '🎯 Aim for at least 80% test coverage for production code'
      )
    }

    recommendations.push(
      '📝 Set up automated coverage reporting in CI/CD pipeline'
    )
    recommendations.push(
      '🔧 Configure coverage thresholds to prevent regressions'
    )

    return {
      totalFiles: results.length,
      averageCoverage: Math.round(averageCoverage * 100) / 100,
      highRiskFiles,
      recommendations
    }
  }

  generateCoverageComment(summary: TestCoverageSummary): string {
    let comment = `## 🧪 Test Coverage Analysis\n\n`

    comment += `**Overall Coverage:** ${summary.averageCoverage}% across ${summary.totalFiles} files\n\n`

    if (summary.highRiskFiles.length > 0) {
      comment += `### 🚨 High Risk Files (Low Coverage)\n\n`

      for (const file of summary.highRiskFiles.slice(0, 5)) {
        // Limit to 5 files
        comment += `- **${file.filePath}**: ${file.coveragePercentage}% coverage\n`

        if (file.suggestedTests.length > 0) {
          comment += `  - Suggestions: ${file.suggestedTests
            .slice(0, 2)
            .join(', ')}\n`
        }
      }

      if (summary.highRiskFiles.length > 5) {
        comment += `- ... and ${summary.highRiskFiles.length - 5} more files\n`
      }

      comment += '\n'
    }

    if (summary.recommendations.length > 0) {
      comment += `### 💡 Recommendations\n\n`
      summary.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    return comment
  }
}
