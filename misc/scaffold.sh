#!/bin/bash
mkdir -p server/db server/trpc server/routers web/src/lib web/src/pages shared

touch \
server/db/index.ts \
server/db/schema.ts \
server/trpc/context.ts \
server/trpc/trpc.ts \
server/trpc/router.ts \
server/routers/auth.ts \
server/routers/notes.ts \
server/index.ts \
web/src/lib/trpc.ts \
web/src/pages/Login.tsx \
web/src/pages/Notes.tsx \
web/src/main.tsx \
shared/types.ts \
drizzle.config.ts \
package.json