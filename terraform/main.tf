provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_d1_database" "family_agent_db" {
  account_id = var.cloudflare_account_id
  name       = "family-agent-db"
}

resource "cloudflare_workers_script" "family_agent_worker" {
  account_id         = var.cloudflare_account_id
  script_name        = var.worker_name
  content            = file(var.worker_bundle_path)
  main_module        = "index.js"
  compatibility_date = "2026-08-18"

  bindings = [
    {
      type = "d1"
      name = "DB"
      id   = cloudflare_d1_database.family_agent_db.id
    },
    {
      type = "plain_text"
      name = "ZEN_MODEL"
      text = var.zen_model
    },
    {
      type = "plain_text"
      name = "ZEN_BASE_URL"
      text = var.zen_base_url
    },
    {
      type = "plain_text"
      name = "ALLOWED_CHAT_IDS"
      text = var.allowed_chat_ids
    },
    {
      type = "plain_text"
      name = "ALLOWED_ORIGINS"
      text = var.allowed_origins
    },
    {
      type = "secret_text"
      name = "TELEGRAM_BOT_TOKEN"
      text = var.telegram_bot_token
    },
    {
      type = "secret_text"
      name = "TELEGRAM_WEBHOOK_SECRET"
      text = var.telegram_webhook_secret
    },
    {
      type = "secret_text"
      name = "OPENCODE_GO_API_KEY"
      text = var.zen_api_key
    }
  ]
}

resource "cloudflare_pages_project" "family_agent_web" {
  account_id        = var.cloudflare_account_id
  name              = var.pages_project_name
  production_branch = var.production_branch
}
