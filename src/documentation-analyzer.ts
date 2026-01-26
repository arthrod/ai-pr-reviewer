import {info, warning} from '@actions/core'

export interface DocumentationIssue {
  type:
    | 'missing_function_docs'
    | 'missing_class_docs'
    | 'outdated_docs'
    | 'incomplete_docs'
    | 'no_readme'
    | 'no_changelog'
    | 'no_examples'
    | 'poor_formatting'
  severity: 'low' | 'medium' | 'high' | 'critical'
  filePath: string
  lineNumber?: number
  functionName?: string
  className?: string
  description: string
  suggestion: string
  docType?: string
}

export interface DocumentationMetrics {
  totalFunctions: number
  documentedFunctions: number
  totalClasses: number
  documentedClasses: number
  totalFiles: number
  filesWithDocs: number
  readmeExists: boolean
  changelogExists: boolean
  examplesExist: boolean
}

export interface DocumentationAnalysisResult {
  issues: DocumentationIssue[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  metrics: DocumentationMetrics
  recommendations: string[]
  coverageScore: number // 0-100, higher is better
}

export class DocumentationAnalyzer {
  private readonly documentationPatterns = {
    jsDoc: /\/\*\*[\s\S]*?\*\//g,
    tsDoc: /\/\*\*[\s\S]*?\*\//g,
    pythonDoc: /"""[\s\S]*?"""/g,
    javaDoc: /\/\*\*[\s\S]*?\*\//g,
    goDoc: /\/\/[\s\S]*?(?=\n\/\/|\n\w|\n$)/g,
    rustDoc: /\/\/\/[\s\S]*?(?=\n\/\/\/|\n\w|\n$)/g
  }

  private readonly codePatterns = {
    function: {
      javascript: [
        /function\s+(\w+)\s*\(/g,
        /const\s+(\w+)\s*=\s*\(/g,
        /(\w+)\s*:\s*function\s*\(/g,
        /async\s+function\s+(\w+)\s*\(/g,
        /(\w+)\s*\([^)]*\)\s*{/g,
        /(\w+)\s*\([^)]*\)\s*=>/g
      ] as RegExp[],
      typescript: [
        /function\s+(\w+)\s*\(/g,
        /const\s+(\w+)\s*=\s*\(/g,
        /(\w+)\s*:\s*function\s*\(/g,
        /async\s+function\s+(\w+)\s*\(/g,
        /(\w+)\s*\([^)]*\)\s*{/g,
        /(\w+)\s*\([^)]*\)\s*=>/g,
        /(\w+)\s*\([^)]*\)\s*:\s*\w+/g
      ] as RegExp[],
      python: [/def\s+(\w+)\s*\(/g] as RegExp[],
      java: [
        /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:synchronized\s+)?(?:native\s+)?(?:strictfp\s+)?\w+\s+(\w+)\s*\(/g
      ] as RegExp[]
    },
    class: {
      javascript: [/class\s+(\w+)/g] as RegExp[],
      typescript: [
        /class\s+(\w+)/g,
        /interface\s+(\w+)/g,
        /type\s+(\w+)\s*=/g
      ] as RegExp[],
      python: [/class\s+(\w+)/g] as RegExp[],
      java: [
        /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)/g,
        /(?:public\s+)?interface\s+(\w+)/g
      ] as RegExp[]
    }
  }

  async analyzeDocumentation(
    filePaths: string[],
    fileContents: Map<string, string>
  ): Promise<DocumentationAnalysisResult> {
    const issues: DocumentationIssue[] = []
    const metrics: DocumentationMetrics = {
      totalFunctions: 0,
      documentedFunctions: 0,
      totalClasses: 0,
      documentedClasses: 0,
      totalFiles: filePaths.length,
      filesWithDocs: 0,
      readmeExists: false,
      changelogExists: false,
      examplesExist: false
    }

    // Check for project-level documentation
    this.checkProjectDocumentation(filePaths, fileContents, issues, metrics)

    // Analyze each file
    for (const filePath of filePaths) {
      const content = fileContents.get(filePath)
      if (!content) continue

      const fileAnalysis = this.analyzeFile(filePath, content)
      issues.push(...fileAnalysis.issues)

      metrics.totalFunctions += fileAnalysis.functions
      metrics.documentedFunctions += fileAnalysis.documentedFunctions
      metrics.totalClasses += fileAnalysis.classes
      metrics.documentedClasses += fileAnalysis.documentedClasses

      if (fileAnalysis.hasDocumentation) {
        metrics.filesWithDocs++
      }
    }

    return this.generateDocumentationResult(issues, metrics)
  }

  private checkProjectDocumentation(
    filePaths: string[],
    fileContents: Map<string, string>,
    issues: DocumentationIssue[],
    metrics: DocumentationMetrics
  ): void {
    // Check for README
    const readmeFiles = filePaths.filter(path => {
      const fileName = path.toLowerCase()
      return (
        fileName.includes('readme') ||
        fileName === 'readme.md' ||
        fileName === 'readme.txt'
      )
    })

    if (readmeFiles.length === 0) {
      issues.push({
        type: 'no_readme',
        severity: 'critical',
        filePath: 'project',
        description: 'No README file found in the project',
        suggestion:
          'Add a README.md file with project description, installation, and usage instructions'
      })
    } else {
      metrics.readmeExists = true

      // Check README quality
      for (const readmePath of readmeFiles) {
        const content = fileContents.get(readmePath)
        if (content) {
          this.checkReadmeQuality(readmePath, content, issues)
        }
      }
    }

    // Check for CHANGELOG
    const changelogFiles = filePaths.filter(path => {
      const fileName = path.toLowerCase()
      return (
        fileName.includes('changelog') ||
        fileName.includes('history') ||
        fileName.includes('changes')
      )
    })

    if (changelogFiles.length === 0) {
      issues.push({
        type: 'no_changelog',
        severity: 'medium',
        filePath: 'project',
        description: 'No CHANGELOG file found in the project',
        suggestion:
          'Add a CHANGELOG.md file to track version changes and releases'
      })
    } else {
      metrics.changelogExists = true
    }

    // Check for examples
    const exampleFiles = filePaths.filter(path => {
      const fileName = path.toLowerCase()
      return (
        fileName.includes('example') ||
        fileName.includes('demo') ||
        fileName.includes('sample')
      )
    })

    if (exampleFiles.length === 0) {
      issues.push({
        type: 'no_examples',
        severity: 'medium',
        filePath: 'project',
        description: 'No examples or demos found in the project',
        suggestion: 'Add examples directory with usage examples and demos'
      })
    } else {
      metrics.examplesExist = true
    }
  }

  private checkReadmeQuality(
    filePath: string,
    content: string,
    issues: DocumentationIssue[]
  ): void {
    const lines = content.split('\n')
    const contentLower = content.toLowerCase()

    // Check for essential sections
    const requiredSections = [
      {pattern: /installation|install|getting started/, name: 'Installation'},
      {pattern: /usage|how to use|example/, name: 'Usage'},
      {pattern: /description|about|intro/, name: 'Description'}
    ]

    for (const section of requiredSections) {
      if (!section.pattern.test(contentLower)) {
        issues.push({
          type: 'incomplete_docs',
          severity: 'medium',
          filePath,
          description: `README missing ${section.name} section`,
          suggestion: `Add a ${section.name} section to the README`
        })
      }
    }

    // Check for badges
    if (!content.includes('[') || !content.includes('](')) {
      issues.push({
        type: 'poor_formatting',
        severity: 'low',
        filePath,
        description:
          'README could benefit from badges for build status, coverage, etc.',
        suggestion:
          'Add badges to README for build status, test coverage, and other metrics'
      })
    }

    // Check length
    if (content.length < 200) {
      issues.push({
        type: 'incomplete_docs',
        severity: 'medium',
        filePath,
        description: 'README appears to be too short',
        suggestion:
          'Expand README with more detailed information about the project'
      })
    }
  }

  private analyzeFile(
    filePath: string,
    content: string
  ): {
    issues: DocumentationIssue[]
    functions: number
    documentedFunctions: number
    classes: number
    documentedClasses: number
    hasDocumentation: boolean
  } {
    const issues: DocumentationIssue[] = []
    const lines = content.split('\n')
    const fileExtension = filePath.split('.').pop()?.toLowerCase()

    let functions = 0
    let documentedFunctions = 0
    let classes = 0
    let documentedClasses = 0
    let hasDocumentation = false

    // Determine language
    const language = this.detectLanguage(fileExtension, filePath)

    // Find functions and check their documentation
    const functionMatches = this.findFunctions(content, language)
    functions = functionMatches.length

    for (const funcMatch of functionMatches) {
      const isDocumented = this.isFunctionDocumented(funcMatch, content, lines)
      if (isDocumented) {
        documentedFunctions++
      } else {
        issues.push({
          type: 'missing_function_docs',
          severity: 'medium',
          filePath,
          lineNumber: funcMatch.lineNumber,
          functionName: funcMatch.name,
          description: `Function '${funcMatch.name}' lacks documentation`,
          suggestion: `Add JSDoc/TSdoc comments explaining the function's purpose, parameters, and return value`
        })
      }
    }

    // Find classes and check their documentation
    const classMatches = this.findClasses(content, language)
    classes = classMatches.length

    for (const classMatch of classMatches) {
      const isDocumented = this.isClassDocumented(classMatch, content, lines)
      if (isDocumented) {
        documentedClasses++
      } else {
        issues.push({
          type: 'missing_class_docs',
          severity: 'medium',
          filePath,
          lineNumber: classMatch.lineNumber,
          className: classMatch.name,
          description: `Class '${classMatch.name}' lacks documentation`,
          suggestion: `Add JSDoc/TSdoc comments explaining the class's purpose and usage`
        })
      }
    }

    // Check for any documentation in the file
    hasDocumentation = this.hasAnyDocumentation(content, language)

    return {
      issues,
      functions,
      documentedFunctions,
      classes,
      documentedClasses,
      hasDocumentation
    }
  }

  private detectLanguage(
    extension: string | undefined,
    filePath: string
  ): string {
    if (!extension) return 'javascript'

    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      cs: 'csharp',
      cpp: 'cpp',
      c: 'c',
      h: 'c',
      hpp: 'cpp'
    }

    return languageMap[extension] || 'javascript'
  }

  private findFunctions(
    content: string,
    language: string
  ): Array<{name: string; lineNumber: number; index: number}> {
    const functions: Array<{name: string; lineNumber: number; index: number}> =
      []
    const patterns =
      this.codePatterns.function[
        language as keyof typeof this.codePatterns.function
      ] || this.codePatterns.function.javascript

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        functions.push({
          name: match[1],
          lineNumber: content.substring(0, match.index).split('\n').length,
          index: match.index
        })
      }
    }

    return functions
  }

  private findClasses(
    content: string,
    language: string
  ): Array<{name: string; lineNumber: number; index: number}> {
    const classes: Array<{name: string; lineNumber: number; index: number}> = []
    const patterns =
      this.codePatterns.class[
        language as keyof typeof this.codePatterns.class
      ] || this.codePatterns.class.javascript

    for (const pattern of patterns) {
      let match
      while ((match = pattern.exec(content)) !== null) {
        classes.push({
          name: match[1],
          lineNumber: content.substring(0, match.index).split('\n').length,
          index: match.index
        })
      }
    }

    return classes
  }

  private isFunctionDocumented(
    funcMatch: {name: string; lineNumber: number; index: number},
    content: string,
    lines: string[]
  ): boolean {
    const linesBefore = lines.slice(0, funcMatch.lineNumber - 1)

    // Check for documentation immediately before the function
    for (
      let i = linesBefore.length - 1;
      i >= Math.max(0, linesBefore.length - 5);
      i--
    ) {
      const line = linesBefore[i].trim()

      // Check for various documentation patterns
      if (
        line.startsWith('/**') ||
        line.startsWith('"""') ||
        line.startsWith('///')
      ) {
        return true
      }

      // Stop if we hit another function or class
      if (this.isCodeStructure(line)) {
        break
      }
    }

    return false
  }

  private isClassDocumented(
    classMatch: {name: string; lineNumber: number; index: number},
    content: string,
    lines: string[]
  ): boolean {
    const linesBefore = lines.slice(0, classMatch.lineNumber - 1)

    // Check for documentation immediately before the class
    for (
      let i = linesBefore.length - 1;
      i >= Math.max(0, linesBefore.length - 5);
      i--
    ) {
      const line = linesBefore[i].trim()

      // Check for various documentation patterns
      if (
        line.startsWith('/**') ||
        line.startsWith('"""') ||
        line.startsWith('///')
      ) {
        return true
      }

      // Stop if we hit another class or function
      if (this.isCodeStructure(line)) {
        break
      }
    }

    return false
  }

  private hasAnyDocumentation(content: string, language: string): boolean {
    const patterns = Object.values(this.documentationPatterns)

    for (const pattern of patterns) {
      if (pattern.test(content)) {
        return true
      }
    }

    return false
  }

  private isCodeStructure(line: string): boolean {
    return /^(function|class|interface|type|const|let|var|export|import|public|private|protected)/.test(
      line
    )
  }

  private generateDocumentationResult(
    issues: DocumentationIssue[],
    metrics: DocumentationMetrics
  ): DocumentationAnalysisResult {
    const summary = {
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    }

    const recommendations = this.generateRecommendations(issues, metrics)
    const coverageScore = this.calculateCoverageScore(metrics)

    return {
      issues,
      summary,
      metrics,
      recommendations,
      coverageScore
    }
  }

  private generateRecommendations(
    issues: DocumentationIssue[],
    metrics: DocumentationMetrics
  ): string[] {
    const recommendations: string[] = []

    if (this.hasIssueType(issues, 'no_readme')) {
      recommendations.push('📖 Create a comprehensive README.md file')
    }

    if (this.hasIssueType(issues, 'no_changelog')) {
      recommendations.push('📝 Add a CHANGELOG.md to track version history')
    }

    if (this.hasIssueType(issues, 'no_examples')) {
      recommendations.push('💡 Add examples or demos to showcase usage')
    }

    if (this.hasIssueType(issues, 'missing_function_docs')) {
      recommendations.push('📚 Document all public functions with JSDoc/TSdoc')
    }

    if (this.hasIssueType(issues, 'missing_class_docs')) {
      recommendations.push('🏗️ Document all classes and interfaces')
    }

    if (this.hasIssueType(issues, 'incomplete_docs')) {
      recommendations.push('✏️ Improve documentation completeness and quality')
    }

    if (this.hasIssueType(issues, 'poor_formatting')) {
      recommendations.push('🎨 Improve documentation formatting and structure')
    }

    // General recommendations
    if (issues.length > 0) {
      recommendations.push(
        '📋 Follow documentation best practices for your language'
      )
      recommendations.push('🔄 Keep documentation updated with code changes')
      recommendations.push('🔍 Use automated tools to validate documentation')
      recommendations.push('📖 Include code examples in documentation')
    }

    // Metrics-based recommendations
    if (
      metrics.totalFunctions > 0 &&
      metrics.documentedFunctions < metrics.totalFunctions * 0.8
    ) {
      recommendations.push(
        `📊 Document ${
          metrics.totalFunctions - metrics.documentedFunctions
        } undocumented functions`
      )
    }

    if (
      metrics.totalClasses > 0 &&
      metrics.documentedClasses < metrics.totalClasses * 0.8
    ) {
      recommendations.push(
        `🏗️ Document ${
          metrics.totalClasses - metrics.documentedClasses
        } undocumented classes`
      )
    }

    return recommendations
  }

  private hasIssueType(
    issues: DocumentationIssue[],
    type: DocumentationIssue['type']
  ): boolean {
    return issues.some(i => i.type === type)
  }

  private calculateCoverageScore(metrics: DocumentationMetrics): number {
    let score = 0
    let totalWeight = 0

    // Function documentation coverage (40% weight)
    if (metrics.totalFunctions > 0) {
      const functionCoverage =
        metrics.documentedFunctions / metrics.totalFunctions
      score += functionCoverage * 40
      totalWeight += 40
    }

    // Class documentation coverage (30% weight)
    if (metrics.totalClasses > 0) {
      const classCoverage = metrics.documentedClasses / metrics.totalClasses
      score += classCoverage * 30
      totalWeight += 30
    }

    // Project documentation (30% weight)
    let projectScore = 0
    if (metrics.readmeExists) projectScore += 15
    if (metrics.changelogExists) projectScore += 7.5
    if (metrics.examplesExist) projectScore += 7.5

    score += projectScore
    totalWeight += 30

    // Normalize score
    return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0
  }

  generateDocumentationComment(result: DocumentationAnalysisResult): string {
    let comment = `## 📚 Documentation Quality Validation\n\n`

    const totalIssues =
      result.summary.critical +
      result.summary.high +
      result.summary.medium +
      result.summary.low

    if (totalIssues === 0) {
      comment += `✅ **No documentation issues detected** in the changed files.\n\n`
      comment += `### 📊 Documentation Coverage Score: ${result.coverageScore}/100\n\n`
      comment += `### 📈 Documentation Metrics\n\n`
      comment += `- **Functions**: ${result.metrics.documentedFunctions}/${result.metrics.totalFunctions} documented\n`
      comment += `- **Classes**: ${result.metrics.documentedClasses}/${result.metrics.totalClasses} documented\n`
      comment += `- **Files with Docs**: ${result.metrics.filesWithDocs}/${result.metrics.totalFiles}\n`
      comment += `- **README**: ${result.metrics.readmeExists ? '✅' : '❌'}\n`
      comment += `- **CHANGELOG**: ${
        result.metrics.changelogExists ? '✅' : '❌'
      }\n`
      comment += `- **Examples**: ${
        result.metrics.examplesExist ? '✅' : '❌'
      }\n\n`
      comment += `### 💡 Documentation Best Practices\n\n`
      comment += `- Maintain comprehensive documentation for all public APIs\n`
      comment += `- Keep documentation updated with code changes\n`
      comment += `- Include examples and usage instructions\n`
      comment += `- Use consistent formatting and structure\n`
      return comment
    }

    comment += `📊 **Documentation Coverage Score: ${result.coverageScore}/100**\n\n`
    comment += `⚠️ **${totalIssues} documentation issues found**\n\n`

    comment += `### 📊 Severity Breakdown\n\n`
    comment += `- 🔴 **Critical**: ${result.summary.critical}\n`
    comment += `- 🟠 **High**: ${result.summary.high}\n`
    comment += `- 🟡 **Medium**: ${result.summary.medium}\n`
    comment += `- 🟢 **Low**: ${result.summary.low}\n\n`

    comment += `### 📈 Documentation Metrics\n\n`
    comment += `- **Functions**: ${result.metrics.documentedFunctions}/${result.metrics.totalFunctions} documented\n`
    comment += `- **Classes**: ${result.metrics.documentedClasses}/${result.metrics.totalClasses} documented\n`
    comment += `- **Files with Docs**: ${result.metrics.filesWithDocs}/${result.metrics.totalFiles}\n`
    comment += `- **README**: ${result.metrics.readmeExists ? '✅' : '❌'}\n`
    comment += `- **CHANGELOG**: ${
      result.metrics.changelogExists ? '✅' : '❌'
    }\n`
    comment += `- **Examples**: ${
      result.metrics.examplesExist ? '✅' : '❌'
    }\n\n`

    // Group issues by severity
    const criticalIssues = result.issues.filter(i => i.severity === 'critical')
    const highIssues = result.issues.filter(i => i.severity === 'high')

    if (criticalIssues.length > 0) {
      comment += `### 🔴 Critical Documentation Issues\n\n`
      for (const issue of criticalIssues.slice(0, 3)) {
        comment += `- **${issue.filePath}**${
          issue.lineNumber ? `:${issue.lineNumber}` : ''
        } - ${issue.description}\n`
        comment += `  - **Suggestion**: ${issue.suggestion}\n\n`
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
        comment += `- **${
          issue.functionName ? `${issue.functionName}() at ` : ''
        }${issue.className ? `${issue.className} at ` : ''}${issue.filePath}**${
          issue.lineNumber ? `:${issue.lineNumber}` : ''
        } - ${issue.description}\n`
        comment += `  - **Suggestion**: ${issue.suggestion}\n\n`
      }
      if (highIssues.length > 3) {
        comment += `- ... and ${
          highIssues.length - 3
        } more high priority issues\n\n`
      }
    }

    if (result.recommendations.length > 0) {
      comment += `### 💡 Documentation Recommendations\n\n`
      result.recommendations.forEach(rec => {
        comment += `${rec}\n`
      })
    }

    return comment
  }
}
