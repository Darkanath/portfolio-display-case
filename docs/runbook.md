# Runbook

Operational reference for the portfolio-display-case infrastructure.
All commands assume `az` CLI is logged in and the correct subscription is active.

---

## Where things live

| Thing | Location |
|---|---|
| Azure resources | Resource group `portfolio-display-case`, region `westeurope` |
| Container images | `ghcr.io/darkanath/{experience,persona,agent}-api:latest` |
| Terraform state | Azure Blob Storage — see [Terraform state](#terraform-state) below |
| Anthropic API key | Azure Container Apps secret `anthropic-api-key` on `agent-api` |
| OIDC credentials | GitHub Actions secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` |
| Frontend | Cloudflare Pages — connected to this GitHub repo |

---

## Terraform state

State is stored in an Azure Storage Account that must be created once before
any `terraform apply`. The backend is configured in `infra/terraform/backend.tf`
(not committed — create it from the example below).

**Create the backend storage (one-time):**

```bash
az group create --name tfstate --location israelcentral
az storage account create \
  --name pdctfstate \
  --resource-group tfstate \
  --sku Standard_LRS \
  --min-tls-version TLS1_2
az storage container create \
  --name tfstate \
  --account-name pdctfstate
```

**`infra/terraform/backend.tf` (create locally, do not commit):**

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate"
    storage_account_name = "pdctfstate"
    container_name       = "tfstate"
    key                  = "portfolio-display-case.tfstate"
  }
}
```

---

## Full redeploy from scratch

Use this when the Azure resource group has been deleted or the subscription
has been reset.

**1. Restore Terraform state access**

```bash
az login
az account set --subscription <subscription-id>
```

**2. Apply infrastructure**

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: set anthropic_api_key and allowed_origins
terraform init
terraform apply
```

`terraform output service_urls` prints the live Container App URLs.

**3. Update Cloudflare Pages env vars**

In the Cloudflare Pages dashboard, set the build environment variables:

```
VITE_EXPERIENCE_API=https://experience-api.<env-domain>
VITE_PERSONA_API=https://persona-api.<env-domain>
VITE_AGENT_API=https://agent-api.<env-domain>
```

Then trigger a new Pages deployment (or push a commit to main).

**4. Update CORS**

Re-run `terraform apply` with `allowed_origins` set to the live Pages URL so
the Container Apps accept requests from the frontend.

**5. Trigger image deploys**

Push an empty commit to main or manually re-run each GitHub Actions workflow.
Path-filtered workflows only fire when their service directory changes, so a
manual re-run is the safest option after a full redeploy.

```bash
gh workflow run experience-api.yml
gh workflow run persona-api.yml
gh workflow run agent-api.yml
```

---

## Rotate the Anthropic API key

**1. Generate a new key** in the [Anthropic Console](https://console.anthropic.com).

**2. Update the Container App secret:**

```bash
az containerapp secret set \
  --name agent-api \
  --resource-group portfolio-display-case \
  --secrets anthropic-api-key=<new-key>

az containerapp update \
  --name agent-api \
  --resource-group portfolio-display-case \
  --set-env-vars ANTHROPIC_API_KEY=secretref:anthropic-api-key
```

The update triggers a new revision. The old key can be revoked immediately
after the new revision is active.

**3. Update `terraform.tfvars`** locally so the next `terraform apply` does
not revert the secret:

```
anthropic_api_key = "<new-key>"
```

**4. Revoke the old key** in the Anthropic Console.

---

## Check whether the live agent is healthy

```bash
# Quick check — all three services
for svc in experience-api persona-api agent-api; do
  echo -n "$svc: "
  curl -sf "https://${svc}.<env-domain>/health" | python3 -m json.tool
done
```

The `agent-api` health response includes `agent_available: true/false`.
If `agent_available` is `false`, the `ANTHROPIC_API_KEY` secret is missing
or empty.

A slow first response (5–15 s) is a cold start, not a failure. Services scale
to zero when idle. Hit `/health` twice if unsure.

---

## View logs

**Portal:** Azure Portal → Resource Group `portfolio-display-case` →
Log Analytics workspace `portfolio-display-case-logs` → Logs.

**CLI — last 100 lines from a service:**

```bash
az monitor log-analytics query \
  --workspace portfolio-display-case-logs \
  --analytics-query "ContainerAppConsoleLogs_CL
    | where ContainerAppName_s == 'agent-api'
    | order by TimeGenerated desc
    | take 100" \
  --output table
```

Replace `agent-api` with `experience-api` or `persona-api` as needed.

**Live tail (stream):**

```bash
az containerapp logs show \
  --name agent-api \
  --resource-group portfolio-display-case \
  --follow
```

Logs are structured JSON, one event per line, retained for 30 days.

---

## Emergency: disable the chat without a redeploy

Set `ANTHROPIC_API_KEY` to an empty string. The `agent-api` will return 503
and the frontend chat panel will show its error state. No other service is
affected.

```bash
az containerapp secret set \
  --name agent-api \
  --resource-group portfolio-display-case \
  --secrets anthropic-api-key=""

az containerapp update \
  --name agent-api \
  --resource-group portfolio-display-case \
  --set-env-vars ANTHROPIC_API_KEY=secretref:anthropic-api-key
```
