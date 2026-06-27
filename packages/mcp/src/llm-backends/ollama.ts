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

export class OllamaBackend {
  private endpoint: string

  constructor(endpoint: string = DEFAULT_ENDPOINT) {
    this.endpoint = endpoint.replace(/\/+$/, '')
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

    const response = await globalThis.fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Ollama generate failed: ${response.status} ${response.statusText}`)
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

    const response = await globalThis.fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Ollama chat failed: ${response.status} ${response.statusText}`)
    }

    return (await response.json()) as ChatResponse
  }

  async listModels(): Promise<OllamaModel[]> {
    const response = await globalThis.fetch(`${this.endpoint}/api/tags`)

    if (!response.ok) {
      throw new Error(`Ollama list models failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as { models: OllamaModel[] }
    return data.models ?? []
  }
}
