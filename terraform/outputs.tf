output "d1_database_id" {
  description = "Use this ID in worker/wrangler.jsonc before remote migrations."
  value       = cloudflare_d1_database.family_agent_db.id
}

output "worker_name" {
  value = cloudflare_workers_script.family_agent_worker.script_name
}

output "pages_project_url" {
  value = "https://${cloudflare_pages_project.family_agent_web.name}.pages.dev"
}
