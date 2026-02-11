#!/bin/sh

# Run database migrations - warn on failure but don't block app startup
if node_modules/.bin/prisma migrate deploy; then
  echo "✅ Migrations applied successfully"
else
  echo "⚠️ Migration failed - starting app anyway. Check migration status."
fi

exec ./node_modules/.bin/remix-serve ./build/server/index.js
