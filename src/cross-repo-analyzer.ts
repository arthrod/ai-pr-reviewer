import {info, warning} from '@actions/core'

export interface CrossRepoImpact {
  type:
    | 'api_break'
    | 'dependency_break'
    | 'config_break'
    | 'schema_break'
    | 'contract_break'
    | 'service_break'
  severity: 'low' | 'medium' | 'high' | 'critical'
  repository: string
  service: string
  impactDescription: string
  affectedFiles: string[]
  recommendation: string
  confidence: number // 0-100
}

export interface CrossRepoMetrics {
  totalRepositories: number
  affectedRepositories: number
  criticalImpacts: number
  highImpacts: number
  mediumImpacts: number
  lowImpacts: number
  confidenceScore: number
}

export interface CrossRepoAnalysisResult {
  impacts: CrossRepoImpact[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  metrics: CrossRepoMetrics
  recommendations: string[]
  riskAssessment: 'low' | 'medium' | 'high' | 'critical'
}

export class CrossRepoAnalyzer {
  private readonly repositoryDependencies = new Map<string, string[]>()
  private readonly serviceContracts = new Map<string, any>()
  private readonly apiEndpoints = new Map<string, any>()
  private readonly databaseSchemas = new Map<string, any>()

  constructor() {
    this.initializeMockData()
  }

  private initializeMockData(): void {
    // Mock repository dependencies
    this.repositoryDependencies.set('frontend-app', [
      'api-service',
      'auth-service',
      'user-service'
    ])
    this.repositoryDependencies.set('api-service', [
      'database-service',
      'cache-service',
      'notification-service'
    ])
    this.repositoryDependencies.set('auth-service', [
      'database-service',
      'token-service'
    ])
    this.repositoryDependencies.set('user-service', [
      'database-service',
      'profile-service'
    ])
    this.repositoryDependencies.set('admin-dashboard', [
      'api-service',
      'auth-service',
      'analytics-service'
    ])

    // Mock service contracts
    this.serviceContracts.set('api-service', {
      endpoints: ['/api/users', '/api/auth', '/api/orders'],
      version: 'v1.2.0',
      breakingChanges: [
        'user_id field renamed to userId',
        'auth endpoint requires new parameter'
      ]
    })

    this.serviceContracts.set('auth-service', {
      endpoints: ['/auth/login', '/auth/logout', '/auth/refresh'],
      version: 'v2.0.0',
      breakingChanges: [
        'JWT token format changed',
        'session management updated'
      ]
    })

    // Mock API endpoints
    this.apiEndpoints.set('api-service', {
      '/api/users': {
        method: 'GET',
        response: {id: 'string', name: 'string', email: 'string'},
        version: 'v1'
      },
      '/api/auth/login': {
        method: 'POST',
        request: {username: 'string', password: 'string'},
        response: {token: 'string', user: 'object'},
        version: 'v1'
      }
    })

    // Mock database schemas
    this.databaseSchemas.set('database-service', {
      users: {
        id: 'UUID',
        username: 'VARCHAR',
        email: 'VARCHAR',
        created_at: 'TIMESTAMP'
      },
      orders: {
        id: 'UUID',
        user_id: 'UUID',
        total: 'DECIMAL',
        status: 'VARCHAR'
      }
    })
  }

  async analyzeCrossRepoImpact(
    changedFiles: string[],
    fileContents: Map<string, string>
  ): Promise<CrossRepoAnalysisResult> {
    const impacts: CrossRepoImpact[] = []

    // Analyze each changed file for potential cross-repo impacts
    for (const filePath of changedFiles) {
      const content = fileContents.get(filePath)
      if (!content) continue

      const fileImpacts = await this.analyzeFileForImpacts(filePath, content)
      impacts.push(...fileImpacts)
    }

    // Remove duplicates and consolidate impacts
    const consolidatedImpacts = this.consolidateImpacts(impacts)

    const summary = {
      critical: consolidatedImpacts.filter(i => i.severity === 'critical')
        .length,
      high: consolidatedImpacts.filter(i => i.severity === 'high').length,
      medium: consolidatedImpacts.filter(i => i.severity === 'medium').length,
      low: consolidatedImpacts.filter(i => i.severity === 'low').length
    }

    const metrics = this.calculateMetrics(consolidatedImpacts)
    const recommendations = this.generateRecommendations(consolidatedImpacts)
    const riskAssessment = this.assessOverallRisk(summary)

    return {
      impacts: consolidatedImpacts,
      summary,
      metrics,
      recommendations,
      riskAssessment
    }
  }

  private async analyzeFileForImpacts(
    filePath: string,
    content: string
  ): Promise<CrossRepoImpact[]> {
    const impacts: CrossRepoImpact[] = []

    // Check for API changes
    const apiImpacts = this.analyzeAPIChanges(filePath, content)
    impacts.push(...apiImpacts)

    // Check for database schema changes
    const schemaImpacts = this.analyzeSchemaChanges(filePath, content)
    impacts.push(...schemaImpacts)

    // Check for configuration changes
    const configImpacts = this.analyzeConfigChanges(filePath, content)
    impacts.push(...configImpacts)

    // Check for dependency changes
    const dependencyImpacts = this.analyzeDependencyChanges(filePath, content)
    impacts.push(...dependencyImpacts)

    // Check for service contract changes
    const contractImpacts = this.analyzeContractChanges(filePath, content)
    impacts.push(...contractImpacts)

    return impacts
  }

  private analyzeAPIChanges(
    filePath: string,
    content: string
  ): CrossRepoImpact[] {
    const impacts: CrossRepoImpact[] = []

    // Check for API endpoint modifications
    const apiPatterns = [
      /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /@([A-Z]+)\s*\(\s*['"`]([^'"`]+)['"`]/g // Express decorators
    ]

    for (const pattern of apiPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const endpoint = match[2]
        const method = match[1]

        // Check if this is a breaking change
        if (this.isBreakingAPIChange(content, endpoint, method)) {
          impacts.push({
            type: 'api_break',
            severity: 'high',
            repository: 'api-service',
            service: 'api-gateway',
            impactDescription: `API endpoint ${method.toUpperCase()} ${endpoint} modified with breaking changes`,
            affectedFiles: [filePath],
            recommendation:
              'Update all client applications that consume this endpoint',
            confidence: 85
          })
        }
      }
    }

    // Check for response structure changes
    const responsePatterns = [
      /res\.json\s*\(\s*\{([^}]+)\}\s*\)/g,
      /return\s*\{([^}]+)\}/g
    ]

    for (const pattern of responsePatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        // Analyze response structure changes
        if (this.hasBreakingResponseChanges(match[1])) {
          impacts.push({
            type: 'contract_break',
            severity: 'medium',
            repository: 'api-service',
            service: 'frontend-app',
            impactDescription: 'API response structure changed',
            affectedFiles: [filePath],
            recommendation: 'Update frontend models and parsing logic',
            confidence: 70
          })
        }
      }
    }

    return impacts
  }

  private analyzeSchemaChanges(
    filePath: string,
    content: string
  ): CrossRepoImpact[] {
    const impacts: CrossRepoImpact[] = []

    // Check for database schema modifications
    const schemaPatterns = [
      /CREATE TABLE\s+(\w+)/gi,
      /ALTER TABLE\s+(\w+)/gi,
      /DROP TABLE\s+(\w+)/gi,
      /ADD COLUMN\s+(\w+)/gi,
      /DROP COLUMN\s+(\w+)/gi
    ]

    for (const pattern of schemaPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const tableName = match[1]

        impacts.push({
          type: 'schema_break',
          severity: 'critical',
          repository: 'database-service',
          service: 'all-services',
          impactDescription: `Database schema change detected for table: ${tableName}`,
          affectedFiles: [filePath],
          recommendation:
            'Coordinate database migration with all dependent services',
          confidence: 95
        })
      }
    }

    // Check for model/ORM changes
    const modelPatterns = [
      /class\s+(\w+)\s+extends\s+Model/gi,
      /@Entity\s*\(\s*\{\s*name:\s*['"`]([^'"`]+)['"`]/gi,
      /mongoose\.Schema\s*\(/gi
    ]

    for (const pattern of modelPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const modelName = match[1] || match[2]

        if (this.hasBreakingModelChanges(content, modelName)) {
          impacts.push({
            type: 'schema_break',
            severity: 'high',
            repository: 'database-service',
            service: 'api-service',
            impactDescription: `Model definition changed for: ${modelName}`,
            affectedFiles: [filePath],
            recommendation: 'Update all services that use this model',
            confidence: 80
          })
        }
      }
    }

    return impacts
  }

  private analyzeConfigChanges(
    filePath: string,
    content: string
  ): CrossRepoImpact[] {
    const impacts: CrossRepoImpact[] = []

    // Check for configuration file changes
    if (
      filePath.includes('.env') ||
      filePath.includes('config') ||
      filePath.includes('settings')
    ) {
      impacts.push({
        type: 'config_break',
        severity: 'medium',
        repository: 'shared-config',
        service: 'all-services',
        impactDescription: 'Configuration file modified',
        affectedFiles: [filePath],
        recommendation: 'Update configuration in all dependent services',
        confidence: 60
      })
    }

    // Check for environment variable changes
    const envPatterns = [/process\.env\.(\w+)/g, /\$\{(\w+)\}/g, /env\.(\w+)/g]

    for (const pattern of envPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const envVar = match[1]

        if (this.isNewEnvironmentVariable(envVar)) {
          impacts.push({
            type: 'config_break',
            severity: 'low',
            repository: 'shared-config',
            service: 'deployment',
            impactDescription: `New environment variable required: ${envVar}`,
            affectedFiles: [filePath],
            recommendation:
              'Add environment variable to all deployment configurations',
            confidence: 75
          })
        }
      }
    }

    return impacts
  }

  private analyzeDependencyChanges(
    filePath: string,
    content: string
  ): CrossRepoImpact[] {
    const impacts: CrossRepoImpact[] = []

    // Check for package.json changes
    if (filePath.includes('package.json')) {
      impacts.push({
        type: 'dependency_break',
        severity: 'medium',
        repository: 'shared-dependencies',
        service: 'all-applications',
        impactDescription: 'Package dependencies updated',
        affectedFiles: [filePath],
        recommendation: 'Update dependencies in all consuming applications',
        confidence: 65
      })
    }

    // Check for import/require changes
    const importPatterns = [
      /import.*from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    ]

    for (const pattern of importPatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const importPath = match[1]

        if (this.isInternalDependency(importPath)) {
          impacts.push({
            type: 'dependency_break',
            severity: 'low',
            repository: 'internal-modules',
            service: 'dependent-services',
            impactDescription: `Internal dependency modified: ${importPath}`,
            affectedFiles: [filePath],
            recommendation: 'Verify compatibility with dependent services',
            confidence: 70
          })
        }
      }
    }

    return impacts
  }

  private analyzeContractChanges(
    filePath: string,
    content: string
  ): CrossRepoImpact[] {
    const impacts: CrossRepoImpact[] = []

    // Check for interface/type definition changes
    const interfacePatterns = [
      /interface\s+(\w+)/g,
      /type\s+(\w+)\s*=/g,
      /class\s+(\w+)/g
    ]

    for (const pattern of interfacePatterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        const typeName = match[1]

        if (this.isPublicContract(typeName)) {
          impacts.push({
            type: 'contract_break',
            severity: 'medium',
            repository: 'shared-types',
            service: 'frontend-app',
            impactDescription: `Public contract modified: ${typeName}`,
            affectedFiles: [filePath],
            recommendation: 'Update all consumers of this contract',
            confidence: 75
          })
        }
      }
    }

    return impacts
  }

  private isBreakingAPIChange(
    content: string,
    endpoint: string,
    method: string
  ): boolean {
    const breakingIndicators = [
      'res.status(4)',
      'throw new Error',
      'deprecated',
      'removed',
      'changed'
    ]

    return breakingIndicators.some(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase())
    )
  }

  private hasBreakingResponseChanges(responseContent: string): boolean {
    const breakingPatterns = [
      /id:\s*['"`]?\w+['"`]?\s*->\s*['"`]?\w+['"`]?/g, // Field rename
      /required:\s*\[/g, // Required fields
      /type:\s*['"`]?\w+['"`]?\s*->\s*['"`]?\w+['"`]?/g // Type change
    ]

    return breakingPatterns.some(pattern => pattern.test(responseContent))
  }

  private hasBreakingModelChanges(content: string, modelName: string): boolean {
    const breakingIndicators = [
      'removeColumn',
      'dropColumn',
      'renameColumn',
      'changeColumn',
      'removeField',
      'deleteField'
    ]

    return breakingIndicators.some(indicator =>
      content.toLowerCase().includes(indicator.toLowerCase())
    )
  }

  private isNewEnvironmentVariable(envVar: string): boolean {
    // Mock logic - in real implementation, would check against known env vars
    const commonEnvVars = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET']
    return !commonEnvVars.includes(envVar)
  }

  private isInternalDependency(importPath: string): boolean {
    return (
      importPath.startsWith('@/') ||
      importPath.startsWith('../') ||
      importPath.startsWith('./')
    )
  }

  private isPublicContract(typeName: string): boolean {
    // Mock logic - in real implementation, would check against public API contracts
    const publicPrefixes = [
      'User',
      'Order',
      'Product',
      'API',
      'Response',
      'Request'
    ]
    return publicPrefixes.some(prefix => typeName.startsWith(prefix))
  }

  private consolidateImpacts(impacts: CrossRepoImpact[]): CrossRepoImpact[] {
    // Remove duplicates and consolidate similar impacts
    const uniqueImpacts = new Map<string, CrossRepoImpact>()

    for (const impact of impacts) {
      const key = `${impact.type}-${impact.repository}-${impact.service}-${impact.impactDescription}`

      if (!uniqueImpacts.has(key)) {
        uniqueImpacts.set(key, impact)
      } else {
        // Merge with existing impact
        const existing = uniqueImpacts.get(key)!
        existing.affectedFiles.push(...impact.affectedFiles)
        existing.confidence = Math.max(existing.confidence, impact.confidence)
      }
    }

    return Array.from(uniqueImpacts.values())
  }

  private calculateMetrics(impacts: CrossRepoImpact[]): CrossRepoMetrics {
    const affectedRepos = new Set(impacts.map(i => i.repository))
    const avgConfidence =
      impacts.length > 0
        ? impacts.reduce((sum, i) => sum + i.confidence, 0) / impacts.length
        : 0

    return {
      totalRepositories: this.repositoryDependencies.size,
      affectedRepositories: affectedRepos.size,
      criticalImpacts: impacts.filter(i => i.severity === 'critical').length,
      highImpacts: impacts.filter(i => i.severity === 'high').length,
      mediumImpacts: impacts.filter(i => i.severity === 'medium').length,
      lowImpacts: impacts.filter(i => i.severity === 'low').length,
      confidenceScore: Math.round(avgConfidence)
    }
  }

  private generateRecommendations(impacts: CrossRepoImpact[]): string[] {
    const recommendations: string[] = []

    if (impacts.some(i => i.type === 'api_break')) {
      recommendations.push(
        '🔗 **API Changes**: Coordinate API versioning and communicate changes to all consumers'
      )
    }

    if (impacts.some(i => i.type === 'schema_break')) {
      recommendations.push(
        '🗄️ **Schema Changes**: Plan database migrations and update all dependent services'
      )
    }

    if (impacts.some(i => i.type === 'config_break')) {
      recommendations.push(
        '⚙️ **Config Changes**: Update configuration across all environments and services'
      )
    }

    if (impacts.some(i => i.type === 'dependency_break')) {
      recommendations.push(
        '📦 **Dependency Changes**: Verify compatibility and update all consuming applications'
      )
    }

    if (impacts.some(i => i.type === 'contract_break')) {
      recommendations.push(
        '📋 **Contract Changes**: Update all clients that use these contracts'
      )
    }

    if (impacts.some(i => i.severity === 'critical')) {
      recommendations.push(
        '🚨 **Critical Impact**: Immediate coordination required with all teams'
      )
    }

    // General recommendations
    recommendations.push(
      '📢 **Communication**: Notify all dependent teams about upcoming changes'
    )
    recommendations.push(
      '🔄 **Testing**: Run integration tests across all affected services'
    )
    recommendations.push(
      '📋 **Documentation**: Update API documentation and change logs'
    )
    recommendations.push(
      '🚀 **Deployment**: Consider phased rollout to minimize impact'
    )

    return recommendations
  }

  private assessOverallRisk(
    summary: CrossRepoAnalysisResult['summary']
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (summary.critical > 0) return 'critical'
    if (summary.high > 2) return 'high'
    if (summary.high > 0 || summary.medium > 3) return 'medium'
    return 'low'
  }

  generateCrossRepoComment(result: CrossRepoAnalysisResult): string {
    let comment = `## 🔗 Cross-Repository Impact Analysis\n\n`

    const riskEmojis = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    }

    comment += `${
      riskEmojis[result.riskAssessment]
    } **Overall Risk Assessment: ${result.riskAssessment.toUpperCase()}**\n\n`

    comment += `### 📊 Impact Summary\n\n`
    comment += `- **Critical**: ${result.summary.critical}\n`
    comment += `- **High**: ${result.summary.high}\n`
    comment += `- **Medium**: ${result.summary.medium}\n`
    comment += `- **Low**: ${result.summary.low}\n`
    comment += `- **Total**: ${
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low
    }\n\n`

    comment += `### 🏗️ Repository Impact Metrics\n\n`
    comment += `- **Total Repositories**: ${result.metrics.totalRepositories}\n`
    comment += `- **Affected Repositories**: ${result.metrics.affectedRepositories}\n`
    comment += `- **Confidence Score**: ${result.metrics.confidenceScore}%\n\n`

    if (result.impacts.length > 0) {
      // Group impacts by type
      const impactsByType = result.impacts.reduce((acc, impact) => {
        if (!acc[impact.type]) acc[impact.type] = []
        acc[impact.type].push(impact)
        return acc
      }, {} as Record<string, CrossRepoImpact[]>)

      comment += `### 🎯 Detailed Impact Analysis\n\n`

      for (const [type, impacts] of Object.entries(impactsByType)) {
        const typeEmojis = {
          api_break: '🔗',
          dependency_break: '📦',
          config_break: '⚙️',
          schema_break: '🗄️',
          contract_break: '📋',
          service_break: '🚀'
        }

        comment += `#### ${
          typeEmojis[type as keyof typeof typeEmojis] || '📌'
        } ${type.replace('_', ' ').toUpperCase()}\n\n`

        for (const impact of impacts.slice(0, 3)) {
          // Limit to 3 per type for readability
          const severityEmoji = {
            critical: '🔴',
            high: '🟠',
            medium: '🟡',
            low: '🟢'
          }

          comment += `- **${impact.repository}** → **${impact.service}**\n`
          comment += `  ${severityEmoji[impact.severity]} ${
            impact.impactDescription
          }\n`
          comment += `  💡 **Recommendation**: ${impact.recommendation}\n`
          comment += `  📊 **Confidence**: ${impact.confidence}%\n\n`
        }

        if (impacts.length > 3) {
          comment += `- ... and ${
            impacts.length - 3
          } more impacts of this type\n\n`
        }
      }
    }

    if (result.recommendations.length > 0) {
      comment += `### 💡 Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    comment += `### 🔄 Coordination Requirements\n\n`
    comment += `This change may impact multiple repositories. Consider the following coordination steps:\n\n`
    comment += `1. **Notify Teams**: Alert all teams maintaining affected repositories\n`
    comment += `2. **Schedule Changes**: Plan coordinated deployment windows\n`
    comment += `3. **Test Integration**: Run cross-repository integration tests\n`
    comment += `4. **Monitor Impact**: Watch for issues after deployment\n`
    comment += `5. **Rollback Plan**: Prepare rollback procedures if needed\n\n`

    return comment
  }
}
