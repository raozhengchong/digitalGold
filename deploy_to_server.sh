#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./deploy_to_server.sh <server_user> <server_host> [server_dir] [image_tar] [ssh_port] [required_arch]
#
# Example:
#   ./deploy_to_server.sh ubuntu 1.2.3.4 /opt/fashion-starter \
#     docker-images/fashion-starter-services-20260625.tar 27877 amd64

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <server_user> <server_host> [server_dir] [image_tar] [ssh_port] [required_arch]"
  exit 1
fi

SERVER_USER="$1"
SERVER_HOST="$2"
SERVER_DIR="${3:-/opt/fashion-starter}"
IMAGE_TAR_REL="${4:-docker-images/fashion-starter-services-20260625.tar}"
SSH_PORT="${5:-22}"
REQUIRED_ARCH="${6:-amd64}"

LOCAL_ROOT="$(cd "$(dirname "$0")" && pwd)"
IMAGE_TAR="${LOCAL_ROOT}/${IMAGE_TAR_REL}"
COMPOSE_FILE="${LOCAL_ROOT}/docker-compose.yml"
ENV_FILE="${LOCAL_ROOT}/.env"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Error: docker-compose.yml not found at ${COMPOSE_FILE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Error: .env not found at ${ENV_FILE}"
  exit 1
fi

if [[ ! -f "${IMAGE_TAR}" ]]; then
  echo "Error: image tar not found at ${IMAGE_TAR}"
  exit 1
fi

TARGET="${SERVER_USER}@${SERVER_HOST}"

get_tar_images() {
  tar -xOf "${IMAGE_TAR}" manifest.json 2>/dev/null | python3 -c '
import json, sys
manifest = json.load(sys.stdin)
for entry in manifest:
    for tag in entry.get("RepoTags") or []:
        print(tag)
'
}

services_for_image() {
  local image="$1"
  case "${image}" in
    fashion-starter-medusa*|*/fashion-starter-medusa*)
      echo "medusa"
      ;;
    fashion-starter-storefront*|*/fashion-starter-storefront*)
      echo "storefront"
      ;;
    *)
      echo ""
      ;;
  esac
}

image_arch_from_tar() {
  local image="$1"
  TAR_PATH="${IMAGE_TAR}" IMAGE_TAG="${image}" python3 -c '
import json, os, sys, tarfile
tar_path = os.environ["TAR_PATH"]
image_tag = os.environ["IMAGE_TAG"]
with tarfile.open(tar_path, "r") as tar:
    manifest = json.load(tar.extractfile("manifest.json"))
    config_path = None
    for entry in manifest:
        if image_tag in (entry.get("RepoTags") or []):
            config_path = entry["Config"]
            break
    if not config_path:
        sys.exit(1)
    config = json.load(tar.extractfile(config_path))
    print(config.get("architecture", "unknown"))
'
}

echo "==> Reading images from tar: $(basename "${IMAGE_TAR}")"
TAR_IMAGES="$(get_tar_images)"
if [[ -z "${TAR_IMAGES}" ]]; then
  echo "Error: no images found in ${IMAGE_TAR}"
  exit 1
fi

echo "${TAR_IMAGES}" | sed 's/^/  - /'

echo "==> Checking image architecture (${REQUIRED_ARCH})"
COMPOSE_UP_SERVICES=()
while IFS= read -r image; do
  [[ -z "${image}" ]] && continue
  if docker image inspect "${image}" >/dev/null 2>&1; then
    IMAGE_ARCH="$(docker image inspect --format '{{.Architecture}}' "${image}" | head -n 1)"
  else
    echo "  local image not found: ${image} (reading architecture from tar)"
    if ! IMAGE_ARCH="$(image_arch_from_tar "${image}")"; then
      echo "Error: could not read architecture for ${image} from tar"
      exit 1
    fi
  fi

  if [[ "${IMAGE_ARCH}" != "${REQUIRED_ARCH}" ]]; then
    echo "Error: image architecture mismatch: ${image}"
    echo "  expected: ${REQUIRED_ARCH}"
    echo "  actual:   ${IMAGE_ARCH}"
    echo "Hint: rebuild with buildx, e.g.:"
    echo "  docker buildx build --platform linux/${REQUIRED_ARCH} -t <image>:<tag> --load <context>"
    exit 1
  fi

  service="$(services_for_image "${image}")"
  if [[ -n "${service}" ]]; then
    COMPOSE_UP_SERVICES+=("${service}")
  fi
done <<EOF
${TAR_IMAGES}
EOF
echo "==> Architecture check passed"

if [[ ${#COMPOSE_UP_SERVICES[@]} -gt 0 ]]; then
  COMPOSE_UP_ARGS="up -d ${COMPOSE_UP_SERVICES[*]}"
else
  COMPOSE_UP_ARGS="up -d"
fi

echo "==> Preparing remote directory: ${SERVER_DIR}"
ssh -p "${SSH_PORT}" "${TARGET}" "sudo mkdir -p '${SERVER_DIR}' && sudo chown -R \$USER:\$USER '${SERVER_DIR}'"

echo "==> Uploading files"
scp -P "${SSH_PORT}" "${COMPOSE_FILE}" "${TARGET}:${SERVER_DIR}/docker-compose.yml"
scp -P "${SSH_PORT}" "${ENV_FILE}" "${TARGET}:${SERVER_DIR}/.env"
scp -P "${SSH_PORT}" "${IMAGE_TAR}" "${TARGET}:${SERVER_DIR}/"

IMAGE_NAME="$(basename "${IMAGE_TAR}")"

echo "==> Loading images and starting services remotely"
ssh -p "${SSH_PORT}" "${TARGET}" "cd '${SERVER_DIR}' && docker load -i '${IMAGE_NAME}' && if docker compose version >/dev/null 2>&1; then COMPOSE='docker compose'; elif command -v docker-compose >/dev/null 2>&1; then COMPOSE='docker-compose'; else echo 'Error: docker compose plugin not found on server (install docker-compose-plugin or docker-compose).'; exit 1; fi && \$COMPOSE ${COMPOSE_UP_ARGS} && \$COMPOSE ps"

echo "==> Done."
echo "Remote logs:"
echo "ssh -p ${SSH_PORT} ${TARGET} \"cd '${SERVER_DIR}' && if docker compose version >/dev/null 2>&1; then docker compose logs -f medusa storefront; else docker-compose logs -f medusa storefront; fi\""
