import {info, setFailed, warning} from '@actions/core'
import {GoogleGenAI} from '@google/genai'
import pRetry from 'p-retry'
import {GeminiOptions, Options} from './options'

export interface Ids {
  parentMessageId?: string
  conversationId?: string
}

export class Bot {
  private readonly ai: GoogleGenAI | null = null
  private readonly options: Options
  private readonly geminiOptions: GeminiOptions
  private readonly systemMessage: string

  constructor(options: Options, geminiOptions: GeminiOptions) {
    this.options = options
    this.geminiOptions = geminiOptions

    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    if (!apiKey) {
      const err =
        "Unable to initialize the Gemini API, 'GEMINI_API_KEY' environment variable is not available"
      throw new Error(err)
    }

    const currentDate = new Date().toISOString().split('T')[0]
    this.systemMessage = `${options.systemMessage}
Knowledge cutoff: ${geminiOptions.tokenLimits.knowledgeCutOff}
Current date: ${currentDate}

IMPORTANT: Entire response must be in the language with ISO code: ${options.language}
`

    this.ai = new GoogleGenAI({apiKey})
  }

  chat = async (message: string, ids: Ids): Promise<[string, Ids]> => {
    let res: [string, Ids] = ['', {}]
    try {
      res = await this.chat_(message, ids)
      return res
    } catch (e: unknown) {
      warning(`Failed to chat: ${e}`)
      return res
    }
  }

  private readonly chat_ = async (
    message: string,
    ids: Ids
  ): Promise<[string, Ids]> => {
    const start = Date.now()
    if (!message) {
      return ['', {}]
    }

    if (this.ai == null) {
      setFailed('The Gemini API is not initialized')
      return ['', {}]
    }

    let responseText = ''
    try {
      const result = await pRetry(
        async () => {
          const response = await this.ai!.models.generateContent({
            model: this.geminiOptions.model,
            contents: message,
            config: {
              systemInstruction: this.systemMessage,
              temperature: this.options.geminiModelTemperature,
              maxOutputTokens: this.geminiOptions.tokenLimits.responseTokens,
              tools: [{googleSearch: {}}]
            }
          })
          return response
        },
        {
          retries: this.options.geminiRetries
        }
      )

      const end = Date.now()
      info(
        `gemini generateContent (including retries) response time: ${
          end - start
        } ms`
      )

      responseText = result.text ?? ''
    } catch (e: unknown) {
      info(`failed to send message to gemini: ${e}`)
    }

    if (!responseText) {
      warning('gemini response is empty')
    }

    // remove the prefix "with " in the response
    if (responseText.startsWith('with ')) {
      responseText = responseText.substring(5)
    }
    if (this.options.debug) {
      info(`gemini responses: ${responseText}`)
    }
    const newIds: Ids = {
      parentMessageId: ids.parentMessageId,
      conversationId: ids.conversationId
    }
    return [responseText, newIds]
  }
}
