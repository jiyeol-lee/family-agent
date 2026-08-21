variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers, D1, and Pages edit permissions."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID."
  type        = string
}

variable "worker_name" {
  description = "Deployed Worker script name."
  type        = string
  default     = "family-agent-worker"
}

variable "pages_project_name" {
  description = "Cloudflare Pages project name."
  type        = string
  default     = "family-agent-web"
}

variable "production_branch" {
  description = "Production branch for the Pages project."
  type        = string
  default     = "main"
}

variable "worker_bundle_path" {
  description = "Wrangler dry-run bundle path, relative to the Terraform directory."
  type        = string
  default     = "../worker/dist/index.js"
}

variable "telegram_bot_token" {
  description = "Telegram BotFather token. Stored as a secret_text Worker binding (and therefore in sensitive Terraform state)."
  type        = string
  sensitive   = true
}

variable "telegram_webhook_secret" {
  description = "Random secret Telegram sends in the webhook header."
  type        = string
  sensitive   = true
}

variable "zen_api_key" {
  description = "OpenCode Zen API key."
  type        = string
  sensitive   = true
}

variable "zen_model" {
  description = "OpenCode Zen model name."
  type        = string
  default     = "deepseek-v4-flash"
}

variable "zen_base_url" {
  description = "OpenAI-compatible OpenCode Zen base URL."
  type        = string
  default     = "https://opencode.ai/zen/v1"
}

variable "allowed_chat_ids" {
  description = "Optional comma-separated Telegram chat IDs. Empty allows any chat with the webhook URL."
  type        = string
  default     = ""
}

variable "allowed_origins" {
  description = "Comma-separated frontend origins allowed by CORS."
  type        = string
  default     = "*"
}
