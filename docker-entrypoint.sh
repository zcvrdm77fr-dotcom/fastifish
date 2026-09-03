#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/var/data}"
mkdir -p "$DATA_DIR" "$DATA_DIR/uploads" "$DATA_DIR/backups"
chown -R node:node "$DATA_DIR"

exec gosu node "$@"
