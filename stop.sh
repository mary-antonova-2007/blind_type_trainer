#!/usr/bin/env sh
set -eu

CONTAINER_NAME="${CONTAINER_NAME:-blind-type-trainer}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER_NAME"; then
  echo "Stopping and removing container: $CONTAINER_NAME"
  docker rm -f "$CONTAINER_NAME" >/dev/null
  echo "Stopped."
else
  echo "Container is not running: $CONTAINER_NAME"
fi
