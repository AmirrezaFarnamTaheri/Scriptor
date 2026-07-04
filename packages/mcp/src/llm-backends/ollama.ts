export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  model?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
  system?: string
}

export interface ChatOptions {
  model?: string
  temperature?: number
  topP?: number
  maxTokens?: number
  stream?: boolean
}

export interface GenerateResponse {
  model: string
  response: string
  done: boolean
  totalDuration?: number
  evalCount?: number
}

export interface ChatResponse {
  model: string
  message: ChatMessage
  done: boolean
  totalDuration?: number
  evalCount?: number
}

export interface OllamaModel {
  name: string
  size: number
  digest: string
  modifiedAt: string
}

const DEFAULT_ENDPOINT = 'http://localhost:11434'
const DEFAULT_TIMEOUT_MS = 120_000

export class OllamaBackend {
  private endpoint: string
  private timeoutMs: number

  constructor(endpoint: string = DEFAULT_ENDPOINT, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.endpoint = endpoint.replace(/\/+$/, '')
    this.timeoutMs = timeoutMs
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      return await globalThis.fetch(url, { ...init, signal: controller.signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.timeoutMs}ms`, { cause: error })
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  private async parseErrorResponse(response: Response): Promise<string> {
    try {
      const body = await response.json() as { error?: string; message?: string }
      return body.error ?? body.message ?? `${response.status} ${response.statusText}`
    } catch {
      return `${response.status} ${response.statusText}`
    }
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<GenerateResponse> {
    const body: Record<string, unknown> = {
      model: options?.model ?? 'llama3.2',
      prompt,
      stream: false,
    }
    if (options?.system) body.system = options.system
    if (options?.temperature !== undefined) body.temperature = options.temperature
    if (options?.topP !== undefined) body.top_p = options.topP
    if (options?.maxTokens !== undefined) body.num_predict = options.maxTokens

    const response = await this.fetchWithTimeout(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const detail = await this.parseErrorResponse(response)
      throw new Error(`Ollama generate failed: ${detail}`)
    }

    return (await response.json()) as GenerateResponse
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: options?.model ?? 'llama3.2',
      messages,
      stream: false,
    }
    if (options?.temperature !== undefined) body.temperature = options.temperature
    if (options?.topP !== undefined) body.top_p = options.topP
    if (options?.maxTokens !== undefined) body.num_predict = options.maxTokens

    const response = await this.fetchWithTimeout(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const detail = await this.parseErrorResponse(response)
      throw new Error(`Ollama chat failed: ${detail}`)
    }

    return (await response.json()) as ChatResponse
  }

  async listModels(): Promise<OllamaModel[]> {
    const response = await this.fetchWithTimeout(`${this.endpoint}/api/tags`, {})

    if (!response.ok) {
      const detail = await this.parseErrorResponse(response)
      throw new Error(`Ollama list models failed: ${detail}`)
    }

    const data = (await response.json()) as { models: OllamaModel[] }
    return data.models ?? []
  }
}
