# Compass — one container: the web app + the API + sign-in on one origin.
# Synthetic corpus only. Built for a demo / pen-test instance, not production
# (production adds KMS, Redis, a private network — see docs/DEPLOY_CHECKLIST.md).

FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
COPY web/package*.json ./web/
RUN npm ci && npm ci --prefix web
COPY . .
# build the 5-year synthetic index + the web bundle
RUN COMPASS_CORPUS=full npm run build:index:full \
 && npm --prefix web run build \
 && npm prune --omit=dev --prefix web

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# the app runs via tsx (dev dep) — keep node_modules from the build stage
COPY --from=build /app ./
RUN useradd -r -u 10001 compass && chown -R compass /app
USER compass
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# pen-test posture: full corpus, egress enforced, demo sign-in on for the tier accounts.
# Set COMPASS_SESSION_SECRET in the host env. Set COMPASS_NO_DEMO=1 to disable demo sign-in.
ENV COMPASS_CORPUS=full COMPASS_PENTEST=1 COMPASS_EGRESS_ENFORCE=1
CMD ["npx", "tsx", "scripts/serve.ts"]
