FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    git \
    pkg-config \
    build-essential \
    libssl-dev \
  && rm -rf /var/lib/apt/lists/*

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps ./apps
COPY crates ./crates
COPY packages ./packages
COPY src ./src
COPY scripts ./scripts
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY eslint.config.js ./
COPY Cargo.toml Cargo.lock ./

RUN pnpm install --frozen-lockfile

CMD ["bash", "-lc", "pnpm build && cargo run -p scriptor-cli -- system-info"]
