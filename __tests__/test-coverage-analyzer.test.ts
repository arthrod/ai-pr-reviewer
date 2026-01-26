import {TestCoverageAnalyzer} from '../src/test-coverage-analyzer'

describe('TestCoverageAnalyzer', () => {
  let analyzer: TestCoverageAnalyzer

  beforeEach(() => {
    analyzer = new TestCoverageAnalyzer()
  })

  describe('isCodeFile', () => {
    it('should identify TypeScript files as code files', () => {
      expect((analyzer as any).isCodeFile('src/test.ts')).toBe(true)
      expect((analyzer as any).isCodeFile('src/test.tsx')).toBe(true)
    })

    it('should identify JavaScript files as code files', () => {
      expect((analyzer as any).isCodeFile('src/test.js')).toBe(true)
      expect((analyzer as any).isCodeFile('src/test.jsx')).toBe(true)
    })

    it('should identify Python files as code files', () => {
      expect((analyzer as any).isCodeFile('src/test.py')).toBe(true)
    })

    it('should not identify non-code files as code files', () => {
      expect((analyzer as any).isCodeFile('README.md')).toBe(false)
      expect((analyzer as any).isCodeFile('config.json')).toBe(false)
      expect((analyzer as any).isCodeFile('image.png')).toBe(false)
    })
  })

  describe('calculateRiskLevel', () => {
    it('should return low risk for coverage >= 80%', () => {
      expect((analyzer as any).calculateRiskLevel(85)).toBe('low')
      expect((analyzer as any).calculateRiskLevel(80)).toBe('low')
    })

    it('should return medium risk for coverage >= 60% and < 80%', () => {
      expect((analyzer as any).calculateRiskLevel(70)).toBe('medium')
      expect((analyzer as any).calculateRiskLevel(60)).toBe('medium')
    })

    it('should return high risk for coverage < 60%', () => {
      expect((analyzer as any).calculateRiskLevel(50)).toBe('high')
      expect((analyzer as any).calculateRiskLevel(0)).toBe('high')
    })
  })

  describe('generateCoverageComment', () => {
    it('should generate a comment with coverage information', () => {
      const summary = {
        totalFiles: 5,
        averageCoverage: 75.5,
        highRiskFiles: [
          {
            filePath: 'src/high-risk.ts',
            coveragePercentage: 30,
            missingLines: [10, 15, 20],
            suggestedTests: [
              'Create test file: src/high-risk.test.ts',
              'Add unit tests'
            ],
            riskLevel: 'high' as const
          }
        ],
        recommendations: [
          '🚨 High priority: Improve test coverage',
          '🎯 Aim for at least 80% test coverage'
        ]
      }

      const comment = analyzer.generateCoverageComment(summary)

      expect(comment).toContain('🧪 Test Coverage Analysis')
      expect(comment).toContain('75.5%')
      expect(comment).toContain('5 files')
      expect(comment).toContain('🚨 High Risk Files')
      expect(comment).toContain('src/high-risk.ts')
      expect(comment).toContain('30% coverage')
      expect(comment).toContain('💡 Recommendations')
    })

    it('should handle empty high risk files', () => {
      const summary = {
        totalFiles: 3,
        averageCoverage: 85,
        highRiskFiles: [],
        recommendations: ['🎯 Aim for at least 80% test coverage']
      }

      const comment = analyzer.generateCoverageComment(summary)

      expect(comment).toContain('🧪 Test Coverage Analysis')
      expect(comment).toContain('85%')
      expect(comment).toContain('3 files')
      expect(comment).not.toContain('🚨 High Risk Files')
    })
  })

  describe('parseJsonCoverage', () => {
    it('should parse valid JSON coverage', () => {
      const jsonCoverage = {
        'src/test.ts': {
          lines: [1, 1, 0, 1],
          coverage: 75
        }
      }

      const result = (analyzer as any).parseJsonCoverage(
        JSON.stringify(jsonCoverage)
      )

      expect(result).toBeDefined()
      expect(result['src/test.ts']).toBeDefined()
      expect(result['src/test.ts'].coverage).toBe(75)
    })

    it('should handle invalid JSON gracefully', () => {
      const result = (analyzer as any).parseJsonCoverage('invalid json')
      expect(result).toBeNull()
    })
  })

  describe('parseLcovCoverage', () => {
    it('should parse LCOV format coverage', () => {
      const lcovContent = `
SF:src/test.ts
DA:1,1
DA:2,1
DA:3,0
DA:4,1
end_of_record
`

      const result = (analyzer as any).parseLcovCoverage(lcovContent)

      expect(result).toBeDefined()
      expect(result['src/test.ts']).toBeDefined()
      expect(result['src/test.ts'].coverage).toBe(75) // 3 out of 4 lines covered
    })
  })

  describe('generateTestSuggestions', () => {
    it('should generate TypeScript-specific suggestions', () => {
      const suggestions = (analyzer as any).generateTestSuggestions(
        'src/test.ts',
        [10, 15]
      )

      expect(suggestions).toContain('Create test file: src/test.test.ts')
      expect(suggestions).toContain('Add tests for uncovered lines: 10, 15')
      expect(suggestions).toContain(
        'Add unit tests for exported functions and classes'
      )
      expect(suggestions).toContain(
        'Consider using Jest or Mocha for testing framework'
      )
    })

    it('should generate Python-specific suggestions', () => {
      const suggestions = (analyzer as any).generateTestSuggestions(
        'src/test.py',
        [10, 15]
      )

      expect(suggestions).toContain('Create test file: src/test.test.py')
      expect(suggestions).toContain('Add unit tests using pytest framework')
    })

    it('should generate generic suggestions when no missing lines', () => {
      const suggestions = (analyzer as any).generateTestSuggestions(
        'src/test.ts',
        []
      )

      expect(suggestions).toContain('Create test file: src/test.test.ts')
      expect(suggestions).toContain('Add unit tests for main functionality')
    })
  })
})
