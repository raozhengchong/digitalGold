.PHONY: env-dev env-server up-dev up-prod up-dev-medusa up-prod-medusa down logs ps seed create-admin

PLATFORM ?= linux/amd64

env-dev:
	cp .env.dev .env

env-server:
	cp .env.server .env

up-dev:
	DOCKER_DEFAULT_PLATFORM=$(PLATFORM) MEDUSA_NODE_ENV=development docker compose up -d --build

up-prod:
	DOCKER_DEFAULT_PLATFORM=$(PLATFORM) MEDUSA_NODE_ENV=production docker compose up -d --build

up-dev-medusa:
	DOCKER_DEFAULT_PLATFORM=$(PLATFORM) MEDUSA_NODE_ENV=development docker compose up -d --build medusa

up-prod-medusa:
	DOCKER_DEFAULT_PLATFORM=$(PLATFORM) MEDUSA_NODE_ENV=production docker compose up -d --build medusa

down:
	docker compose down

logs:
	docker compose logs -f medusa storefront

ps:
	docker compose ps

seed:
	docker compose run --rm medusa yarn seed

create-admin:
	docker compose run --rm medusa yarn medusa user -e "admin@medusa.local" -p "supersecret"
