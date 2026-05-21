#!/usr/bin/env sh
set -eu

IMAGE_NAME="${IMAGE_NAME:-blind-type-trainer}"
CONTAINER_NAME="${CONTAINER_NAME:-blind-type-trainer}"
HOST_PORT="${HOST_PORT:-8080}"
CONTAINER_PORT="${CONTAINER_PORT:-80}"

cd "$(dirname "$0")"

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  echo "Removing existing container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

echo "Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" .

echo "Starting container: $CONTAINER_NAME"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -p "$HOST_PORT:$CONTAINER_PORT" \
  "$IMAGE_NAME"

echo "App is running at http://localhost:$HOST_PORT"
