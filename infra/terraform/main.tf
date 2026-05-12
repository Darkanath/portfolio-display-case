terraform {
  required_version = ">= 1.9"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }

  # Configure a remote backend before running anything real. See backend.tf.example.
}

provider "azurerm" {
  features {}
}

variable "project" {
  type    = string
  default = "portfolio-display-case"
}

variable "location" {
  type    = string
  default = "westeurope"
}

variable "ghcr_owner" {
  description = "GitHub username/org that owns the images on ghcr.io"
  type        = string
}

variable "anthropic_api_key" {
  description = "Anthropic API key for agent-api. Stored as a Container App secret."
  type        = string
  sensitive   = true
}

variable "allowed_origins" {
  description = "Comma-separated list of CORS origins (production frontend URL)"
  type        = string
  default     = "http://localhost:5173"
}

resource "azurerm_resource_group" "rg" {
  name     = var.project
  location = var.location
}

resource "azurerm_log_analytics_workspace" "logs" {
  name                = "${var.project}-logs"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

resource "azurerm_container_app_environment" "env" {
  name                       = "${var.project}-env"
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
}

locals {
  services = {
    experience-api = {
      image = "ghcr.io/${var.ghcr_owner}/experience-api:latest"
      env   = {}
    }
    persona-api = {
      image = "ghcr.io/${var.ghcr_owner}/persona-api:latest"
      env   = {}
    }
    agent-api = {
      image = "ghcr.io/${var.ghcr_owner}/agent-api:latest"
      env = {
        EXPERIENCE_API_URL = "https://experience-api.${azurerm_container_app_environment.env.default_domain}"
        PERSONA_API_URL    = "https://persona-api.${azurerm_container_app_environment.env.default_domain}"
      }
    }
  }
}

resource "azurerm_container_app" "service" {
  for_each                     = local.services
  name                         = each.key
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = azurerm_resource_group.rg.name
  revision_mode                = "Single"

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  dynamic "secret" {
    for_each = each.key == "agent-api" ? [1] : []
    content {
      name  = "anthropic-api-key"
      value = var.anthropic_api_key
    }
  }

  template {
    min_replicas = 0
    max_replicas = 2

    container {
      name   = each.key
      image  = each.value.image
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "PORT"
        value = "8080"
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = var.allowed_origins
      }

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = each.key == "agent-api" ? [1] : []
        content {
          name        = "ANTHROPIC_API_KEY"
          secret_name = "anthropic-api-key"
        }
      }
    }
  }
}

output "service_urls" {
  value = {
    for k, _ in local.services : k => "https://${k}.${azurerm_container_app_environment.env.default_domain}"
  }
}
