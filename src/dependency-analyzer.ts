import {info, warning} from '@actions/core'

export interface DependencyIssue {
  type:
    | 'security_vulnerability'
    | 'breaking_change'
    | 'outdated_major'
    | 'outdated_minor'
    | 'license_conflict'
    | 'dependency_bloat'
    | 'deprecated_package'
  severity: 'low' | 'medium' | 'high' | 'critical'
  packageName: string
  currentVersion: string
  latestVersion?: string
  description: string
  impact: string
  recommendation: string
  cveId?: string
  cvssScore?: number
}

export interface DependencyInfo {
  name: string
  currentVersion: string
  latestVersion: string
  type: 'dependencies' | 'devDependencies' | 'peerDependencies'
  license?: string
  deprecated?: boolean
  securityVulnerabilities?: Array<{
    cveId: string
    severity: string
    cvssScore: number
    description: string
  }>
}

export interface DependencyAnalysisResult {
  issues: DependencyIssue[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  metrics: {
    totalDependencies: number
    outdatedDependencies: number
    vulnerableDependencies: number
    deprecatedDependencies: number
    majorUpdates: number
    minorUpdates: number
  }
  recommendations: string[]
  securityScore: number // 0-100, higher is better
}

export class DependencyAnalyzer {
  private readonly packageManagers = ['npm', 'yarn', 'pnpm']
  private readonly licenseConflicts = [
    {license: 'GPL-3.0', conflicts: ['MIT', 'Apache-2.0', 'BSD']},
    {license: 'AGPL-3.0', conflicts: ['MIT', 'Apache-2.0', 'BSD', 'GPL-3.0']},
    {license: 'LGPL-3.0', conflicts: ['MIT', 'Apache-2.0', 'BSD']}
  ]

  async analyzeDependencies(
    filePaths: string[],
    fileContents: Map<string, string>
  ): Promise<DependencyAnalysisResult> {
    const issues: DependencyIssue[] = []
    const dependencyFiles = this.findDependencyFiles(filePaths, fileContents)
    const allDependencies: DependencyInfo[] = []

    for (const [filePath, content] of dependencyFiles) {
      const dependencies = this.parseDependencyFile(filePath, content)
      allDependencies.push(...dependencies)
    }

    // Analyze each dependency
    for (const dep of allDependencies) {
      const depIssues = await this.analyzeDependency(dep)
      issues.push(...depIssues)
    }

    return this.generateDependencyResult(issues, allDependencies)
  }

  private findDependencyFiles(
    filePaths: string[],
    fileContents: Map<string, string>
  ): Array<[string, string]> {
    const dependencyFiles: Array<[string, string]> = []
    const dependencyFilePatterns = [
      'package.json',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'requirements.txt',
      'Pipfile',
      'Pipfile.lock',
      'Gemfile',
      'Gemfile.lock',
      'pom.xml',
      'build.gradle',
      'Cargo.toml',
      'composer.json'
    ]

    for (const filePath of filePaths) {
      const fileName = filePath.split('/').pop() || filePath
      if (dependencyFilePatterns.some(pattern => fileName.includes(pattern))) {
        const content = fileContents.get(filePath)
        if (content) {
          dependencyFiles.push([filePath, content])
        }
      }
    }

    return dependencyFiles
  }

  private parseDependencyFile(
    filePath: string,
    content: string
  ): DependencyInfo[] {
    const dependencies: DependencyInfo[] = []
    const fileName = filePath.split('/').pop() || filePath

    try {
      if (fileName === 'package.json') {
        const packageJson = JSON.parse(content)

        // Parse dependencies
        if (packageJson.dependencies) {
          for (const [name, version] of Object.entries(
            packageJson.dependencies
          )) {
            dependencies.push({
              name,
              currentVersion: this.normalizeVersion(version as string),
              latestVersion: '', // Will be fetched later
              type: 'dependencies',
              license: this.getLicenseFromPackageJson(packageJson, name)
            })
          }
        }

        // Parse devDependencies
        if (packageJson.devDependencies) {
          for (const [name, version] of Object.entries(
            packageJson.devDependencies
          )) {
            dependencies.push({
              name,
              currentVersion: this.normalizeVersion(version as string),
              latestVersion: '', // Will be fetched later
              type: 'devDependencies',
              license: this.getLicenseFromPackageJson(packageJson, name)
            })
          }
        }

        // Parse peerDependencies
        if (packageJson.peerDependencies) {
          for (const [name, version] of Object.entries(
            packageJson.peerDependencies
          )) {
            dependencies.push({
              name,
              currentVersion: this.normalizeVersion(version as string),
              latestVersion: '', // Will be fetched later
              type: 'peerDependencies',
              license: this.getLicenseFromPackageJson(packageJson, name)
            })
          }
        }
      } else if (fileName === 'requirements.txt') {
        const lines = content.split('\n')
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9\-_.]+)([><=!]+)(.+)$/)
          if (match) {
            dependencies.push({
              name: match[1],
              currentVersion: match[3],
              latestVersion: '',
              type: 'dependencies'
            })
          }
        }
      }
      // Add more package managers as needed
    } catch (error) {
      warning(`Failed to parse dependency file ${filePath}: ${error}`)
    }

    return dependencies
  }

  private getLicenseFromPackageJson(
    packageJson: any,
    packageName: string
  ): string | undefined {
    // This is a simplified approach - in practice, you'd need to check the package's own license
    // For now, we'll return undefined and handle license checking elsewhere
    return undefined
  }

  private normalizeVersion(version: string): string {
    // Remove ^, ~, >=, <=, >, < prefixes
    return version.replace(/^[\^~><=]+/, '').trim()
  }

  private async analyzeDependency(
    dependency: DependencyInfo
  ): Promise<DependencyIssue[]> {
    const issues: DependencyIssue[] = []

    try {
      // Simulate fetching latest version and security info
      // In a real implementation, you would call npm API, GitHub API, or other package manager APIs
      const {latestVersion, securityVulnerabilities, deprecated} =
        await this.fetchDependencyInfo(dependency.name)

      dependency.latestVersion = latestVersion
      dependency.securityVulnerabilities = securityVulnerabilities
      dependency.deprecated = deprecated

      // Check for security vulnerabilities
      if (securityVulnerabilities && securityVulnerabilities.length > 0) {
        for (const vuln of securityVulnerabilities) {
          const severity = this.mapCvssToSeverity(vuln.cvssScore)
          issues.push({
            type: 'security_vulnerability',
            severity,
            packageName: dependency.name,
            currentVersion: dependency.currentVersion,
            latestVersion,
            description: `Security vulnerability: ${vuln.description}`,
            impact: `CVSS Score: ${vuln.cvssScore} - ${vuln.severity}`,
            recommendation:
              'Update to the latest version to patch security vulnerabilities',
            cveId: vuln.cveId,
            cvssScore: vuln.cvssScore
          })
        }
      }

      // Check for deprecated packages
      if (deprecated) {
        issues.push({
          type: 'deprecated_package',
          severity: 'high',
          packageName: dependency.name,
          currentVersion: dependency.currentVersion,
          latestVersion,
          description: 'Package is deprecated',
          impact: 'Package may no longer receive updates or security patches',
          recommendation: 'Migrate to an alternative package or maintained fork'
        })
      }

      // Check for outdated versions
      if (
        latestVersion &&
        this.isVersionOutdated(dependency.currentVersion, latestVersion)
      ) {
        const updateType = this.getUpdateType(
          dependency.currentVersion,
          latestVersion
        )

        if (updateType === 'major') {
          issues.push({
            type: 'breaking_change',
            severity: 'high',
            packageName: dependency.name,
            currentVersion: dependency.currentVersion,
            latestVersion,
            description: 'Major version update available',
            impact: 'May contain breaking changes - review release notes',
            recommendation: 'Test thoroughly in development before updating'
          })
        } else if (updateType === 'minor') {
          issues.push({
            type: 'outdated_minor',
            severity: 'medium',
            packageName: dependency.name,
            currentVersion: dependency.currentVersion,
            latestVersion,
            description: 'Minor version update available',
            impact: 'New features and bug fixes',
            recommendation: 'Update to receive improvements and fixes'
          })
        } else {
          issues.push({
            type: 'outdated_major',
            severity: 'low',
            packageName: dependency.name,
            currentVersion: dependency.currentVersion,
            latestVersion,
            description: 'Patch version update available',
            impact: 'Bug fixes and security patches',
            recommendation: 'Update to receive security patches'
          })
        }
      }

      // Check for dependency bloat (too many dependencies)
      if (
        dependency.type === 'dependencies' &&
        this.isLargeDependency(dependency.name)
      ) {
        issues.push({
          type: 'dependency_bloat',
          severity: 'medium',
          packageName: dependency.name,
          currentVersion: dependency.currentVersion,
          latestVersion,
          description: 'Large dependency with many transitive dependencies',
          impact: 'Increases bundle size and attack surface',
          recommendation: 'Consider lighter alternatives or tree-shaking'
        })
      }
    } catch (error) {
      warning(`Failed to analyze dependency ${dependency.name}: ${error}`)
    }

    return issues
  }

  private async fetchDependencyInfo(packageName: string): Promise<{
    latestVersion: string
    securityVulnerabilities: Array<{
      cveId: string
      severity: string
      cvssScore: number
      description: string
    }>
    deprecated: boolean
  }> {
    // This is a mock implementation - in practice, you would call real APIs
    // For demo purposes, we'll return some simulated data

    const mockData: Record<string, any> = {
      lodash: {
        latestVersion: '4.17.21',
        securityVulnerabilities: [
          {
            cveId: 'CVE-2021-23337',
            severity: 'high',
            cvssScore: 7.5,
            description: 'Prototype pollution in lodash'
          }
        ],
        deprecated: false
      },
      request: {
        latestVersion: '2.88.2',
        securityVulnerabilities: [
          {
            cveId: 'CVE-2023-28155',
            severity: 'critical',
            cvssScore: 9.8,
            description: 'Server-Side Request Forgery'
          }
        ],
        deprecated: true
      },
      moment: {
        legacyVersion: '2.29.4',
        securityVulnerabilities: [],
        deprecated: true
      },
      axios: {
        latestVersion: '1.6.0',
        securityVulnerabilities: [],
        deprecated: false
      }
    }

    return (
      mockData[packageName] || {
        latestVersion: '1.0.0',
        securityVulnerabilities: [],
        deprecated: false
      }
    )
  }

  private isVersionOutdated(current: string, latest: string): boolean {
    try {
      const currentParts = current.split('.').map(Number)
      const latestParts = latest.split('.').map(Number)

      for (
        let i = 0;
        i < Math.max(currentParts.length, latestParts.length);
        i++
      ) {
        const currentPart = currentParts[i] || 0
        const latestPart = latestParts[i] || 0

        if (currentPart < latestPart) return true
        if (currentPart > latestPart) return false
      }

      return false
    } catch {
      return false
    }
  }

  private getUpdateType(
    current: string,
    latest: string
  ): 'major' | 'minor' | 'patch' {
    try {
      const currentParts = current.split('.').map(Number)
      const latestParts = latest.split('.').map(Number)

      if (latestParts[0] > currentParts[0]) return 'major'
      if (latestParts[1] > currentParts[1]) return 'minor'
      return 'patch'
    } catch {
      return 'patch'
    }
  }

  private isLargeDependency(packageName: string): boolean {
    // Mock list of known large dependencies
    const largeDependencies = [
      'moment',
      'lodash',
      'underscore',
      'jquery',
      'bootstrap',
      'material-ui',
      'antd',
      'react-bootstrap',
      'chart.js'
    ]
    return largeDependencies.includes(packageName)
  }

  private mapCvssToSeverity(
    cvssScore: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (cvssScore >= 9.0) return 'critical'
    if (cvssScore >= 7.0) return 'high'
    if (cvssScore >= 4.0) return 'medium'
    return 'low'
  }

  private generateDependencyResult(
    issues: DependencyIssue[],
    dependencies: DependencyInfo[]
  ): DependencyAnalysisResult {
    const summary = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }

    const metrics = {
      totalDependencies: dependencies.length,
      outdatedDependencies: dependencies.filter(
        d =>
          d.latestVersion &&
          this.isVersionOutdated(d.currentVersion, d.latestVersion)
      ).length,
      vulnerableDependencies: dependencies.filter(
        d => d.securityVulnerabilities && d.securityVulnerabilities.length > 0
      ).length,
      deprecatedDependencies: dependencies.filter(d => d.deprecated).length,
      majorUpdates: dependencies.filter(
        d =>
          d.latestVersion &&
          this.getUpdateType(d.currentVersion, d.latestVersion) === 'major'
      ).length,
      minorUpdates: dependencies.filter(
        d =>
          d.latestVersion &&
          this.getUpdateType(d.currentVersion, d.latestVersion) === 'minor'
      ).length
    }

    const recommendations = this.generateRecommendations(issues, dependencies)
    const securityScore = this.calculateSecurityScore(issues, dependencies)

    return {
      issues,
      summary,
      metrics,
      recommendations,
      securityScore
    }
  }

  private generateRecommendations(
    issues: DependencyIssue[],
    dependencies: DependencyInfo[]
  ): string[] {
    const recommendations: string[] = []

    if (this.hasIssueType(issues, 'security_vulnerability')) {
      recommendations.push(
        '🔒 Update packages with security vulnerabilities immediately'
      )
    }

    if (this.hasIssueType(issues, 'deprecated_package')) {
      recommendations.push(
        '📦 Replace deprecated packages with maintained alternatives'
      )
    }

    if (this.hasIssueType(issues, 'breaking_change')) {
      recommendations.push(
        '🔄 Plan major updates carefully and test thoroughly'
      )
    }

    if (this.hasIssueType(issues, 'dependency_bloat')) {
      recommendations.push(
        '📊 Consider lighter alternatives to reduce bundle size'
      )
    }

    // General recommendations
    if (issues.length > 0) {
      recommendations.push('🔍 Set up automated dependency scanning in CI/CD')
      recommendations.push(
        '📈 Use tools like `npm audit` or `snyk` for security scanning'
      )
      recommendations.push('🗓️ Schedule regular dependency updates')
      recommendations.push('📋 Review and update dependencies quarterly')
    }

    // Specific metrics-based recommendations
    if (dependencies.length > 100) {
      recommendations.push('🧹 Consider reducing the number of dependencies')
    }

    const vulnerableCount = dependencies.filter(
      d => d.securityVulnerabilities && d.securityVulnerabilities.length > 0
    ).length
    if (vulnerableCount > 0) {
      recommendations.push(
        `🚨 Address ${vulnerableCount} packages with security vulnerabilities`
      )
    }

    return recommendations
  }

  private hasIssueType(
    issues: DependencyIssue[],
    type: DependencyIssue['type']
  ): boolean {
    return issues.some(i => i.type === type)
  }

  private calculateSecurityScore(
    issues: DependencyIssue[],
    dependencies: DependencyInfo[]
  ): number {
    let score = 100

    // Deduct for security vulnerabilities
    const securityIssues = issues.filter(
      i => i.type === 'security_vulnerability'
    )
    for (const issue of securityIssues) {
      if (issue.severity === 'critical') score -= 30
      else if (issue.severity === 'high') score -= 20
      else if (issue.severity === 'medium') score -= 10
      else score -= 5
    }

    // Deduct for deprecated packages
    const deprecatedCount = dependencies.filter(d => d.deprecated).length
    score -= deprecatedCount * 10

    // Deduct for outdated packages
    const outdatedCount = dependencies.filter(
      d =>
        d.latestVersion &&
        this.isVersionOutdated(d.currentVersion, d.latestVersion)
    ).length
    score -= Math.min(outdatedCount * 2, 20)

    return Math.max(0, score)
  }

  generateDependencyComment(result: DependencyAnalysisResult): string {
    let comment = `## 📦 Dependency Update Intelligence\n\n`

    const totalIssues =
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low

    if (totalIssues === 0) {
      comment += `✅ **No dependency issues detected** in the changed files.\n\n`
      comment += `### 🔒 Security Score: ${result.securityScore}/100\n\n`
      comment += `### 📊 Dependency Metrics\n\n`
      comment += `- **Total Dependencies**: ${result.metrics.totalDependencies}\n`
      comment += `- **Outdated Dependencies**: ${result.metrics.outdatedDependencies}\n`
      comment += `- **Vulnerable Dependencies**: ${result.metrics.vulnerableDependencies}\n`
      comment += `- **Deprecated Dependencies**: ${result.metrics.deprecatedDependencies}\n\n`
      comment += `### 💡 Dependency Best Practices\n\n`
      comment += `- Keep dependencies updated regularly\n`
      comment += `- Monitor for security vulnerabilities\n`
      comment += `- Review and remove unused dependencies\n`
      comment += `- Use automated dependency scanning tools\n`
      return comment
    }

    comment += `🔒 **Security Score: ${result.securityScore}/100**\n\n`
    comment += `⚠️ **${totalIssues} dependency issues found**\n\n`

    comment += `### 📊 Severity Breakdown\n\n`
    comment += `- 🔴 **Critical**: ${result.summary.critical}\n`
    comment += `- 🟠 **High**: ${result.summary.high}\n`
    comment += `- 🟡 **Medium**: ${result.summary.medium}\n`
    comment += `- 🟢 **Low**: ${result.summary.low}\n\n`

    comment += `### 📈 Dependency Metrics\n\n`
    comment += `- **Total Dependencies**: ${result.metrics.totalDependencies}\n`
    comment += `- **Outdated Dependencies**: ${result.metrics.outdatedDependencies}\n`
    comment += `- **Vulnerable Dependencies**: ${result.metrics.vulnerableDependencies}\n`
    comment += `- **Deprecated Dependencies**: ${result.metrics.deprecatedDependencies}\n`
    comment += `- **Major Updates Available**: ${result.metrics.majorUpdates}\n`
    comment += `- **Minor Updates Available**: ${result.metrics.minorUpdates}\n\n`

    // Group issues by severity
    const criticalIssues = result.issues.filter(i => i.severity === 'critical')
    const highIssues = result.issues.filter(i => i.severity === 'high')

    if (criticalIssues.length > 0) {
      comment += `### 🔴 Critical Security Issues\n\n`
      for (const issue of criticalIssues.slice(0, 3)) {
        comment += `- **${issue.packageName}** (${issue.currentVersion} → ${issue.latestVersion})\n`
        comment += `  - **Issue**: ${issue.description}\n`
        comment += `  - **Impact**: ${issue.impact}\n`
        comment += `  - **CVE**: ${issue.cveId || 'N/A'}\n`
        comment += `  - **Recommendation**: ${issue.recommendation}\n\n`
      }
      if (criticalIssues.length > 3) {
        comment += `- ... and ${
          criticalIssues.length - 3
        } more critical issues\n\n`
      }
    }

    if (highIssues.length > 0) {
      comment += `### 🟠 High Priority Issues\n\n`
      for (const issue of highIssues.slice(0, 3)) {
        comment += `- **${issue.packageName}** (${issue.currentVersion} → ${issue.latestVersion})\n`
        comment += `  - **Issue**: ${issue.description}\n`
        comment += `  - **Impact**: ${issue.impact}\n`
        comment += `  - **Recommendation**: ${issue.recommendation}\n\n`
      }
      if (highIssues.length > 3) {
        comment += `- ... and ${
          highIssues.length - 3
        } more high priority issues\n\n`
      }
    }

    if (result.recommendations.length > 0) {
      comment += `### 💡 Dependency Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    return comment
  }
}
