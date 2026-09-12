FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/ai-worker/package.json apps/ai-worker/
COPY supabase/functions/package.json supabase/functions/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile --filter @turism/ai-worker... --prod=false
COPY apps/ai-worker apps/ai-worker
COPY supabase/functions supabase/functions
COPY packages/domain packages/domain
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
HEALTHCHECK CMD wget -qO- http://localhost:8787/health || exit 1
CMD ["pnpm", "--filter", "@turism/ai-worker", "start"]
