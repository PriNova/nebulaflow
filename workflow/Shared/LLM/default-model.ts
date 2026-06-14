/**
 * Default LLM model identifier — pi SDK format.
 *
 * pi model IDs use the provider prefix directly:
 *   "openai/gpt-5.1"
 *   "anthropic/claude-sonnet-4-20250514"
 *   "google/gemini-2.5-pro"
 *
 * Previously this file held an Amp SDK model ID ("openai/gpt-5.1").
 * Amp SDK model IDs are auto-migrated on workflow load via
 * PiIntegration/Application/pi-models.ts.
 */
export const DEFAULT_PI_MODEL_ID = 'openai/gpt-5.1' as const

export const DEFAULT_PI_MODEL_TITLE = 'GPT-5.1' as const

/**
 * Legacy alias for backward compatibility with existing imports.
 * Code that imports DEFAULT_LLM_MODEL_ID will still compile but should
 * migrate to DEFAULT_PI_MODEL_ID.
 */
export const DEFAULT_LLM_MODEL_ID = DEFAULT_PI_MODEL_ID
export const DEFAULT_LLM_MODEL_TITLE = DEFAULT_PI_MODEL_TITLE
