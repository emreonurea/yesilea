# Sunucuyu bir barındırma hizmetinde çalıştırmak için. Proje kök klasöründen derlenir:
#   docker build -f apps/server/Dockerfile -t yesilea-server .
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server
RUN npm install --omit=dev --workspace @menu/server --include-workspace-root=false --no-audit --no-fund
ENV DB_PATH=/data/app.db
ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "apps/server/src/main.ts"]
