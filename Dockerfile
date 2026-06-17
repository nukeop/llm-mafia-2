FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ENV NODE_ENV=production

EXPOSE 3000

# Drop to the unprivileged user the base image ships with for runtime.
USER bun

CMD ["bun", "src/index.ts"]
