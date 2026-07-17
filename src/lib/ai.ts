import OpenAI from "openai";
import { config } from "../config";

/**
 * Provayder-agnostik AI mijoz.
 *
 * OpenAI-mos API'ga ega HAR QANDAY xizmatga ulanadi — faqat .env dagi
 * AI_BASE_URL + AI_MODEL + AI_API_KEY o'zgartiriladi, kod tegmaydi:
 *
 *   DeepSeek : AI_BASE_URL=https://api.deepseek.com                          AI_MODEL=deepseek-chat
 *   OpenAI   : AI_BASE_URL=https://api.openai.com/v1                         AI_MODEL=gpt-4o-mini
 *   Gemini   : AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai  AI_MODEL=gemini-2.5-flash
 *   Local    : AI_BASE_URL=http://localhost:11434/v1                         AI_MODEL=<ollama model>
 */
export const ai = new OpenAI({
  apiKey:     config.aiApiKey,
  baseURL:    config.aiBaseUrl,
  maxRetries: 2,
  timeout:    30_000,
});

export const AI_MODEL = config.aiModel;
