import {SecurityAnalyzer} from '../src/security-analyzer'

describe('SecurityAnalyzer', () => {
  let analyzer: SecurityAnalyzer

  beforeEach(() => {
    analyzer = new SecurityAnalyzer()
  })

  describe('analyzeFile', () => {
    it('should detect SQL injection vulnerabilities', () => {
      const code = `
        const query = "SELECT * FROM users WHERE id = " + userId;
        const result = db.query(query);
      `
      const vulnerabilities = (analyzer as any).analyzeFile('test.js', code)

      expect(vulnerabilities).toHaveLength(1)
      expect(vulnerabilities[0].type).toBe('sql_injection')
      expect(vulnerabilities[0].severity).toBe('critical')
      expect(vulnerabilities[0].filePath).toBe('test.js')
      expect(vulnerabilities[0].lineNumber).toBe(2)
    })

    it('should detect XSS vulnerabilities', () => {
      const code = `
        const userInput = getUserInput();
        element.innerHTML = "Hello " + userInput;
      `
      const vulnerabilities = (analyzer as any).analyzeFile('test.js', code)

      expect(vulnerabilities).toHaveLength(1)
      expect(vulnerabilities[0].type).toBe('xss')
      expect(vulnerabilities[0].severity).toBe('high')
    })

    it('should detect hardcoded passwords', () => {
      const code = `
        const password = "secret123";
        authenticate(username, password);
      `
      const vulnerabilities = (analyzer as any).analyzeFile('test.js', code)

      expect(vulnerabilities).toHaveLength(1)
      expect(vulnerabilities[0].type).toBe('authentication')
      expect(vulnerabilities[0].severity).toBe('high')
    })

    it('should detect weak cryptographic algorithms', () => {
      const code = `
        const hash = MD5(data);
      `
      const vulnerabilities = (analyzer as any).analyzeFile('test.js', code)

      expect(vulnerabilities).toHaveLength(1)
      expect(vulnerabilities[0].type).toBe('crypto')
      expect(vulnerabilities[0].severity).toBe('medium')
    })

    it('should detect command injection vulnerabilities', () => {
      const code = `
        const command = "ls " + userDir;
        exec(command);
      `
      const vulnerabilities = (analyzer as any).analyzeFile('test.js', code)

      expect(vulnerabilities).toHaveLength(2) // One for exec, one for string concatenation
      expect(vulnerabilities.some(v => v.type === 'injection')).toBe(true)
    })

    it('should detect path traversal vulnerabilities', () => {
      const code = `
        const filePath = "../" + fileName;
        readFile(filePath);
      `
      const vulnerabilities = (analyzer as any).analyzeFile('test.js', code)

      expect(vulnerabilities.length).toBeGreaterThan(0)
      expect(vulnerabilities.some(v => v.type === 'path_traversal')).toBe(true)
    })
  })

  describe('calculateSeverity', () => {
    it('should return correct severity for each vulnerability type', () => {
      expect((analyzer as any).calculateSeverity('sql_injection')).toBe(
        'critical'
      )
      expect((analyzer as any).calculateSeverity('xss')).toBe('high')
      expect((analyzer as any).calculateSeverity('authentication')).toBe('high')
      expect((analyzer as any).calculateSeverity('authorization')).toBe('high')
      expect((analyzer as any).calculateSeverity('crypto')).toBe('medium')
      expect((analyzer as any).calculateSeverity('injection')).toBe('critical')
      expect((analyzer as any).calculateSeverity('path_traversal')).toBe('high')
      expect((analyzer as any).calculateSeverity('csrf')).toBe('medium')
    })
  })

  describe('generateSecurityComment', () => {
    it('should generate comment for no vulnerabilities', () => {
      const result = {
        vulnerabilities: [],
        summary: {critical: 0, high: 0, medium: 0, low: 0},
        recommendations: []
      }

      const comment = analyzer.generateSecurityComment(result)

      expect(comment).toContain('✅ **No security vulnerabilities detected**')
      expect(comment).toContain('Security Best Practices')
    })

    it('should generate comment for vulnerabilities found', () => {
      const result = {
        vulnerabilities: [
          {
            type: 'sql_injection' as const,
            severity: 'critical' as const,
            filePath: 'test.js',
            lineNumber: 10,
            description: 'SQL injection detected',
            remediation: 'Use parameterized queries',
            cweId: 'CWE-89',
            owaspCategory: 'A03:2021 – Injection'
          }
        ],
        summary: {critical: 1, high: 0, medium: 0, low: 0},
        recommendations: ['🔒 Implement parameterized queries']
      }

      const comment = analyzer.generateSecurityComment(result)

      expect(comment).toContain('🔒 Security Vulnerability Analysis')
      expect(comment).toContain('🚨 **1 security vulnerabilities found**')
      expect(comment).toContain('🔴 **Critical**: 1')
      expect(comment).toContain('test.js:10')
      expect(comment).toContain('SQL injection detected')
      expect(comment).toContain('Use parameterized queries')
      expect(comment).toContain('CWE-89')
    })

    it('should limit the number of vulnerabilities shown', () => {
      const vulnerabilities = Array.from({length: 10}, (_, i) => ({
        type: 'sql_injection' as const,
        severity: 'critical' as const,
        filePath: `test${i}.js`,
        lineNumber: i + 1,
        description: 'SQL injection detected',
        remediation: 'Use parameterized queries',
        cweId: 'CWE-89',
        owaspCategory: 'A03:2021 – Injection'
      }))

      const result = {
        vulnerabilities,
        summary: {critical: 10, high: 0, medium: 0, low: 0},
        recommendations: ['🔒 Implement parameterized queries']
      }

      const comment = analyzer.generateSecurityComment(result)

      expect(comment).toContain('... and 7 more critical vulnerabilities')
    })
  })

  describe('analyzeSecurity', () => {
    it('should analyze multiple files', async () => {
      const filePaths = ['file1.js', 'file2.js']
      const fileContents = new Map([
        [
          'file1.js',
          'const query = "SELECT * FROM users WHERE id = " + userId;'
        ],
        ['file2.js', 'element.innerHTML = userInput;']
      ])

      const result = await analyzer.analyzeSecurity(filePaths, fileContents)

      expect(result.vulnerabilities).toHaveLength(2)
      expect(result.summary.critical).toBe(1) // SQL injection
      expect(result.summary.high).toBe(1) // XSS
      expect(result.recommendations.length).toBeGreaterThan(0)
    })

    it('should handle empty file contents', async () => {
      const filePaths = ['file1.js']
      const fileContents = new Map()

      const result = await analyzer.analyzeSecurity(filePaths, fileContents)

      expect(result.vulnerabilities).toHaveLength(0)
      expect(result.summary.critical).toBe(0)
    })
  })
})
