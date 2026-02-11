#!/bin/sh
set -e

# Run database migrations using prisma CLI installed during Docker build
# Version matches @prisma/client (6.19.0) and avoids runtime npm registry access
node_modules/.bin/prisma migrate deploy

# Start the app (migrations handled by the NestJS API service)
exec ./node_modules/.bin/remix-serve ./build/server/index.js