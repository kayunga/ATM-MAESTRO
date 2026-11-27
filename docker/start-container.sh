#!/bin/sh
# Container entrypoint for Vercel (and local `docker run`).
# Vercel containers have no persistent disk, so Laravel's writable storage
# lives in /tmp (LARAVEL_STORAGE_PATH). Create its directories before PHP
# starts; otherwise Blade's compiled-view path does not exist.
set -e

STORAGE="${LARAVEL_STORAGE_PATH:-/app/storage}"

mkdir -p \
    "$STORAGE/app/public" \
    "$STORAGE/app/private" \
    "$STORAGE/framework/cache/data" \
    "$STORAGE/framework/sessions" \
    "$STORAGE/framework/views" \
    "$STORAGE/logs"

exec frankenphp run --config /etc/frankenphp/Caddyfile
