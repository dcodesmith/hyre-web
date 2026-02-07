#!/bin/sh
set -e

# Start the app (migrations handled by the NestJS API service)
exec ./node_modules/.bin/remix-serve ./build/server/index.js