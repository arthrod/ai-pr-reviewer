export class TokenLimits {
  maxTokens: number
  requestTokens: number
  responseTokens: number
  knowledgeCutOff: string

  constructor(model = 'gemini-3.1-pro-preview') {
    this.knowledgeCutOff = '2025-01-01'
    if (model.includes('gemini-3.1-pro')) {
      this.maxTokens = 1048576
      this.responseTokens = 65536
    } else if (model.includes('gemini-3') || model.includes('gemini-2')) {
      this.maxTokens = 1048576
      this.responseTokens = 8192
    } else {
      this.maxTokens = 32000
      this.responseTokens = 4000
    }
    // provide some margin for the request tokens
    this.requestTokens = this.maxTokens - this.responseTokens - 100
  }

  string(): string {
    return `max_tokens=${this.maxTokens}, request_tokens=${this.requestTokens}, response_tokens=${this.responseTokens}`
  }
}
