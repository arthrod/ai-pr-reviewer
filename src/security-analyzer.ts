import {info, warning} from '@actions/core'

export interface SecurityVulnerability {
  type:
    | 'sql_injection'
    | 'xss'
    | 'authentication'
    | 'authorization'
    | 'crypto'
    | 'injection'
    | 'path_traversal'
    | 'csrf'
  severity: 'low' | 'medium' | 'high' | 'critical'
  filePath: string
  lineNumber: number
  description: string
  remediation: string
  cweId?: string
  owaspCategory?: string
}

export interface SecurityAnalysisResult {
  vulnerabilities: SecurityVulnerability[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  recommendations: string[]
}

export class SecurityAnalyzer {
  private readonly vulnerabilityPatterns = {
    sql_injection: [
      {
        pattern:
          /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+.*\$\{.*\}/gi,
        description: 'Possible SQL injection through template literal',
        remediation:
          'Use parameterized queries or prepared statements instead of string concatenation'
      },
      {
        pattern:
          /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\s+.*\+.*['"]/gi,
        description: 'Possible SQL injection through string concatenation',
        remediation:
          'Use parameterized queries or prepared statements instead of string concatenation'
      },
      {
        pattern: /query\s*\(\s*['"`][^'"`]*\+[^'"`]*['"`]\s*\)/gi,
        description: 'SQL query with concatenated user input',
        remediation: 'Use parameterized queries or prepared statements'
      }
    ],
    xss: [
      {
        pattern: /innerHTML\s*=.*\$\{.*\}/gi,
        description: 'Possible XSS through template literal in innerHTML',
        remediation:
          'Use textContent instead of innerHTML, or sanitize user input'
      },
      {
        pattern: /innerHTML\s*=.*\+/gi,
        description: 'Possible XSS through string concatenation in innerHTML',
        remediation:
          'Use textContent instead of innerHTML, or sanitize user input'
      },
      {
        pattern: /document\.write\s*\(/gi,
        description: 'Use of document.write can lead to XSS',
        remediation:
          'Avoid document.write, use DOM manipulation methods instead'
      },
      {
        pattern: /eval\s*\(/gi,
        description: 'Use of eval() can lead to code injection',
        remediation:
          'Avoid eval(), use JSON.parse for JSON or safer alternatives'
      }
    ],
    authentication: [
      {
        pattern: /password\s*=\s*['"`][^'"`]*['"`]/gi,
        description: 'Hardcoded password detected',
        remediation: 'Use environment variables or secure credential management'
      },
      {
        pattern: /api[_-]?key\s*=\s*['"`][^'"`]*['"`]/gi,
        description: 'Hardcoded API key detected',
        remediation: 'Use environment variables or secure credential management'
      },
      {
        pattern: /secret\s*=\s*['"`][^'"`]*['"`]/gi,
        description: 'Hardcoded secret detected',
        remediation: 'Use environment variables or secure credential management'
      }
    ],
    authorization: [
      {
        pattern: /isAdmin\s*=\s*true/gi,
        description: 'Hardcoded admin check',
        remediation: 'Implement proper role-based access control'
      },
      {
        pattern: /if\s*\(\s*user\.role\s*===\s*['"`]admin['"`]\s*\)/gi,
        description: 'Hardcoded role check without proper validation',
        remediation:
          'Implement proper role-based access control with validation'
      }
    ],
    crypto: [
      {
        pattern: /MD5\s*\(/gi,
        description: 'Use of weak MD5 hash algorithm',
        remediation: 'Use stronger hashing algorithms like SHA-256 or bcrypt'
      },
      {
        pattern: /SHA1\s*\(/gi,
        description: 'Use of weak SHA-1 hash algorithm',
        remediation: 'Use stronger hashing algorithms like SHA-256 or bcrypt'
      },
      {
        pattern: /crypto\.createHash\s*\(\s*['"`]md5['"`]\s*\)/gi,
        description: 'Use of weak MD5 hash algorithm in Node.js',
        remediation: 'Use stronger hashing algorithms like SHA-256 or bcrypt'
      }
    ],
    injection: [
      {
        pattern: /exec\s*\(/gi,
        description: 'Use of exec() can lead to command injection',
        remediation: 'Use safer alternatives or validate/sanitize input'
      },
      {
        pattern: /spawn\s*\(/gi,
        description: 'Use of spawn() can lead to command injection',
        remediation: 'Use safer alternatives or validate/sanitize input'
      },
      {
        pattern: /system\s*\(/gi,
        description: 'Use of system() can lead to command injection',
        remediation: 'Use safer alternatives or validate/sanitize input'
      }
    ],
    path_traversal: [
      {
        pattern: /\.\.\//gi,
        description: 'Possible path traversal sequence',
        remediation:
          'Validate and sanitize file paths, use chroot jail if possible'
      },
      {
        pattern: /readFile\s*\(\s*.*\+.*\s*\)/gi,
        description: 'File path concatenation can lead to path traversal',
        remediation: 'Validate and sanitize file paths, use path.join()'
      }
    ],
    csrf: [
      {
        pattern:
          /fetch\s*\(\s*['"`][^'"`]*['"`]\s*,\s*\{[^}]*method\s*:\s*['"`](POST|PUT|DELETE)['"`]/gi,
        description: 'State-changing request without CSRF protection',
        remediation: 'Implement CSRF tokens or same-site cookies'
      }
    ]
  }

  private readonly cweMapping = {
    sql_injection: 'CWE-89',
    xss: 'CWE-79',
    authentication: 'CWE-521',
    authorization: 'CWE-285',
    crypto: 'CWE-327',
    injection: 'CWE-78',
    path_traversal: 'CWE-22',
    csrf: 'CWE-352'
  }

  private readonly owaspMapping = {
    sql_injection: 'A03:2021 – Injection',
    xss: 'A03:2021 – Injection',
    authentication: 'A07:2021 – Identification and Authentication Failures',
    authorization: 'A01:2021 – Broken Access Control',
    crypto: 'A02:2021 – Cryptographic Failures',
    injection: 'A03:2021 – Injection',
    path_traversal: 'A01:2021 – Broken Access Control',
    csrf: 'A01:2021 – Broken Access Control'
  }

  async analyzeSecurity(
    filePaths: string[],
    fileContents: Map<string, string>
  ): Promise<SecurityAnalysisResult> {
    const vulnerabilities: SecurityVulnerability[] = []

    for (const filePath of filePaths) {
      const content = fileContents.get(filePath)
      if (!content) continue

      const fileVulnerabilities = this.analyzeFile(filePath, content)
      vulnerabilities.push(...fileVulnerabilities)
    }

    return this.generateSecurityResult(vulnerabilities)
  }

  private analyzeFile(
    filePath: string,
    content: string
  ): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const lines = content.split('\n')

    for (const [vulnerabilityType, patterns] of Object.entries(
      this.vulnerabilityPatterns
    )) {
      for (const patternObj of patterns) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (patternObj.pattern.test(line)) {
            const vulnerability: SecurityVulnerability = {
              type: vulnerabilityType as SecurityVulnerability['type'],
              severity: this.calculateSeverity(
                vulnerabilityType as SecurityVulnerability['type']
              ),
              filePath,
              lineNumber: i + 1,
              description: patternObj.description,
              remediation: patternObj.remediation,
              cweId:
                this.cweMapping[
                  vulnerabilityType as keyof typeof this.cweMapping
                ],
              owaspCategory:
                this.owaspMapping[
                  vulnerabilityType as keyof typeof this.owaspMapping
                ]
            }
            vulnerabilities.push(vulnerability)
          }
        }
      }
    }

    return vulnerabilities
  }

  private calculateSeverity(
    vulnerabilityType: SecurityVulnerability['type']
  ): SecurityVulnerability['severity'] {
    const severityMap: Record<
      SecurityVulnerability['type'],
      SecurityVulnerability['severity']
    > = {
      sql_injection: 'critical',
      xss: 'high',
      authentication: 'high',
      authorization: 'high',
      crypto: 'medium',
      injection: 'critical',
      path_traversal: 'high',
      csrf: 'medium'
    }

    return severityMap[vulnerabilityType] || 'medium'
  }

  private generateSecurityResult(
    vulnerabilities: SecurityVulnerability[]
  ): SecurityAnalysisResult {
    const summary = {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length
    }

    const recommendations = this.generateRecommendations(vulnerabilities)

    return {
      vulnerabilities,
      summary,
      recommendations
    }
  }

  private generateRecommendations(
    vulnerabilities: SecurityVulnerability[]
  ): string[] {
    const recommendations: string[] = []

    if (this.hasVulnerabilityType(vulnerabilities, 'sql_injection')) {
      recommendations.push(
        '🔒 Implement parameterized queries and prepared statements to prevent SQL injection'
      )
    }

    if (this.hasVulnerabilityType(vulnerabilities, 'xss')) {
      recommendations.push(
        '🛡️ Sanitize all user input and use textContent instead of innerHTML to prevent XSS'
      )
    }

    if (this.hasVulnerabilityType(vulnerabilities, 'authentication')) {
      recommendations.push(
        '🔐 Move all credentials to environment variables or secure vault systems'
      )
    }

    if (this.hasVulnerabilityType(vulnerabilities, 'authorization')) {
      recommendations.push(
        '👥 Implement proper role-based access control (RBAC) system'
      )
    }

    if (this.hasVulnerabilityType(vulnerabilities, 'crypto')) {
      recommendations.push(
        '🔑 Replace weak cryptographic algorithms with modern alternatives (SHA-256, bcrypt)'
      )
    }

    if (this.hasVulnerabilityType(vulnerabilities, 'injection')) {
      recommendations.push(
        '⚡ Avoid using exec(), spawn(), or system() with user input'
      )
    }

    if (this.hasVulnerabilityType(vulnerabilities, 'path_traversal')) {
      recommendations.push(
        '📁 Validate and sanitize all file paths to prevent directory traversal'
      )
    }

    if (this.hasVulnerabilityType(vulnerabilities, 'csrf')) {
      recommendations.push(
        '🎯 Implement CSRF tokens for all state-changing operations'
      )
    }

    // General recommendations
    if (vulnerabilities.length > 0) {
      recommendations.push(
        '🔍 Run automated security scanning tools regularly (e.g., npm audit, Snyk)'
      )
      recommendations.push(
        '📚 Keep all dependencies updated to their latest secure versions'
      )
      recommendations.push(
        '🧪 Implement security testing in your CI/CD pipeline'
      )
    }

    return recommendations
  }

  private hasVulnerabilityType(
    vulnerabilities: SecurityVulnerability[],
    type: SecurityVulnerability['type']
  ): boolean {
    return vulnerabilities.some(v => v.type === type)
  }

  generateSecurityComment(result: SecurityAnalysisResult): string {
    let comment = `## 🔒 Security Vulnerability Analysis\n\n`

    const totalVulnerabilities =
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low

    if (totalVulnerabilities === 0) {
      comment += `✅ **No security vulnerabilities detected** in the changed files.\n\n`
      comment += `### 💡 Security Best Practices\n\n`
      comment += `- Continue following secure coding practices\n`
      comment += `- Regularly update dependencies\n`
      comment += `- Implement security testing in CI/CD\n`
      return comment
    }

    comment += `🚨 **${totalVulnerabilities} security vulnerabilities found**\n\n`

    comment += `### 📊 Severity Breakdown\n\n`
    comment += `- 🔴 **Critical**: ${result.summary.critical}\n`
    comment += `- 🟠 **High**: ${result.summary.high}\n`
    comment += `- 🟡 **Medium**: ${result.summary.medium}\n`
    comment += `- 🟢 **Low**: ${result.summary.low}\n\n`

    // Group vulnerabilities by type and severity
    const criticalVulns = result.vulnerabilities.filter(
      v => v.severity === 'critical'
    )
    const highVulns = result.vulnerabilities.filter(v => v.severity === 'high')

    if (criticalVulns.length > 0) {
      comment += `### 🔴 Critical Vulnerabilities\n\n`
      for (const vuln of criticalVulns.slice(0, 3)) {
        // Limit to 3 for readability
        comment += `- **${vuln.filePath}:${vuln.lineNumber}** - ${vuln.description}\n`
        comment += `  - **Remediation**: ${vuln.remediation}\n`
        if (vuln.cweId) comment += `  - **CWE**: ${vuln.cweId}\n`
        if (vuln.owaspCategory)
          comment += `  - **OWASP**: ${vuln.owaspCategory}\n`
        comment += `\n`
      }
      if (criticalVulns.length > 3) {
        comment += `- ... and ${
          criticalVulns.length - 3
        } more critical vulnerabilities\n\n`
      }
    }

    if (highVulns.length > 0) {
      comment += `### 🟠 High Severity Vulnerabilities\n\n`
      for (const vuln of highVulns.slice(0, 3)) {
        // Limit to 3 for readability
        comment += `- **${vuln.filePath}:${vuln.lineNumber}** - ${vuln.description}\n`
        comment += `  - **Remediation**: ${vuln.remediation}\n`
        if (vuln.cweId) comment += `  - **CWE**: ${vuln.cweId}\n`
        comment += `\n`
      }
      if (highVulns.length > 3) {
        comment += `- ... and ${
          highVulns.length - 3
        } more high severity vulnerabilities\n\n`
      }
    }

    if (result.recommendations.length > 0) {
      comment += `### 💡 Security Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    return comment
  }
}
