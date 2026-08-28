# Reproducible CI/validation image.
# Base image is pinned by digest (node:22-bookworm, linux/amd64, verified
# against Docker Hub on 2026-08-25). Bump the tag and digest together.
FROM node@sha256:87a4f951f28b85d189df365d24c479d3bdb70be77c1ff5c9029db2ef67e251ac

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    pkg-config \
    build-essential \
    libssl-dev \
  && rm -rf /var/lib/apt/lists/*

# Rust toolchain is pinned to the repository's rust-toolchain.toml channel.
# The installer script is downloaded to disk first (no pipe-to-shell) so the
# executed file is the exact object TLS delivered from static.rust-lang.org.
ARG RUSTUP_INIT_URL=https://sh.rustup.rs
ARG RUST_TOOLCHAIN=1.96.0
RUN curl -fsSL "$RUSTUP_INIT_URL" -o /tmp/rustup-init.sh \
  && sh /tmp/rustup-init.sh -y --profile minimal --default-toolchain "$RUST_TOOLCHAIN" \
  && rm -f /tmp/rustup-init.sh
ENV PATH="/root/.cargo/bin:${PATH}"

RUN corepack enable

WORKDIR /workspace

# Fetch dependencies first so this layer is cached unless the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY apps ./apps
COPY crates ./crates
COPY packages ./packages
COPY src ./src
COPY public ./public
COPY index.html ./
COPY scripts ./scripts
COPY tsconfig*.json ./
