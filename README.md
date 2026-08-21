# Family Agent

Family Agent is a Telegram-managed family assistant with a public, read-only Angular site. Its first capability is the Purchase Wishlist. A native TypeScript Cloudflare Worker calls OpenCode Zen tools and stores data in D1. There is no HTTP framework or AI SDK.

## Requirements

- A Node.js version supported by the installed Angular CLI and npm 10+
- Terraform 1.7+
- A Cloudflare account and token with Workers Scripts, D1, and Pages edit access
- A Telegram bot token and an OpenCode Zen API key

## Clean local setup

This schema starts at one migration. It is safe to discard the old local D1 state only because this project has not been deployed and has no Terraform state.

```sh
rm -rf worker/.wrangler/state
npm install
cp worker/.dev.vars.example worker/.dev.vars
npm run db:migrate:local --workspace worker
```

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `OPENCODE_GO_API_KEY` in `worker/.dev.vars`. `ALLOWED_CHAT_IDS` is an optional comma-separated list and may contain negative group IDs. Then run the Worker and web app in separate terminals:

```sh
npm run dev --workspace worker
npm run start --workspace frontend
```

The Worker runs at `http://localhost:8787`, Angular at `http://localhost:4200`, and the health route is `/api/v1/health`. Telegram needs an HTTPS tunnel for local webhook testing.

## Bot behavior

The bot accepts text messages. It uses the Telegram sender ID as the trusted actor for every write. Model arguments can never select an actor or agreement identity.

For a new wishlist item, the agent checks all active, purchased, archived, and commented records before asking optional follow-up questions. Exact, substring, and token matching detect likely duplicates. A duplicate creates a pending request that expires after about 30 minutes. The same user must answer in the same chat through a Telegram update whose ID is greater than the update that created the pending request. The only accepted confirmations, after lowercasing, trimming, and collapsing whitespace, are `yes`, `y`, `confirm`, `add it`, and `add anyway`. The accepted cancellations are `no`, `n`, `cancel`, and `do not add`. Other text does not change the request. The trusted message text decides the action, not the model's tool argument.

Telegram may deliver two updates close enough that a later update starts before the earlier update has saved its pending row. In that rare case, the bot makes no change and asks for confirmation again in a new message. The agent stops its tool loop as soon as confirmation is required.

All purchase mutations use one global D1 lease named `purchase-ledger`. D1's `unixepoch()` supplies the acquisition and expiry time, stored as integer epoch seconds. Acquisition is an atomic insert or expired-lease takeover, waits for at most 1.2 seconds, and returns a busy result if another mutation still owns the lease. The owner releases only its own lease. The 60-second lease exceeds Cloudflare's approximately 30-second `waitUntil` execution lifetime, so an expired takeover can occur only after the prior invocation can no longer continue. This serializes duplicate checking with pending or purchase insertion and also serializes edits, completion, comments, agreement, archive changes, and confirmation state changes.

Purchase creation, edits, completion, agreement, archive changes, and their immutable action comments use one D1 batch. The code checks every expected statement's committed change count and re-reads state before reporting success. User comments are append-only and do not change the parent purchase timestamp. Database triggers reject empty, malformed, non-text, or duplicate agreement lists on inserts and updates. Marking an item purchased is irreversible. Agreements cannot be removed. There is no delete, unpurchase, disagree, comment edit, or comment delete path. Archiving is reversible and keeps all history.

The webhook verifies Telegram's secret header, optionally checks the chat allowlist, claims every update ID once, and acknowledges before background processing. Assistant work has an 18-second total deadline. Zen and Telegram calls have shorter timeouts. Failed updates are recorded but not retried automatically. Chat history retains the newest 100 rows per chat.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Liveness check |
| `GET` | `/api/v1/purchases` | Active purchases, the default |
| `GET` | `/api/v1/purchases?scope=archived` | Archived purchases |
| `GET` | `/api/v1/purchases?scope=all` | All purchases |
| `POST` | `/api/telegram/webhook` | Secret-verified Telegram update |

Purchase responses contain public item fields, purchase/archive dates, agreement count, and nested comments. They never expose owner IDs, agreement IDs, actor IDs, or internal actor columns. Action details contain structured changes and timestamps without actor IDs.

## Checks and builds

```sh
npm run check
npm run bundle --workspace worker
terraform -chdir=terraform fmt -check
terraform -chdir=terraform validate
git diff --check
```

Angular emits `frontend/dist/family-agent-web/browser`. Wrangler emits `worker/dist/index.js`; Terraform deploys that generated bundle. Do not edit either output by hand.

## Cloudflare deployment

Build the Worker, copy `terraform/terraform.tfvars.example` to the ignored `terraform/terraform.tfvars`, replace placeholders, and apply Terraform:

```sh
npm run bundle --workspace worker
terraform -chdir=terraform init
terraform -chdir=terraform plan
terraform -chdir=terraform apply
```

Terraform creates D1 as `family-agent-db`, the Worker as `family-agent-worker`, and Pages as `family-agent-web`. Copy the `d1_database_id` output into `worker/wrangler.jsonc`, then apply the clean migration remotely:

```sh
npm run db:migrate:remote --workspace worker
```

Production Worker secrets use `secret_text` bindings and therefore exist in sensitive Terraform state. Use an encrypted remote backend with strict access, or remove those bindings and manage secrets with Wrangler.

The production Angular environment targets `https://jiyeollee.com`. Build and upload the Pages files separately:

```sh
npm run build:frontend:prod
wrangler pages deploy frontend/dist/family-agent-web/browser --project-name family-agent-web
```

Register the Telegram webhook after deployment:

```sh
curl --request POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://<WORKER_HOST>/api/telegram/webhook","secret_token":"<WEBHOOK_SECRET>","allowed_updates":["message"]}'
```

Keep the bot token, webhook secret, Zen key, Terraform variables, and `.dev.vars` out of version control.
