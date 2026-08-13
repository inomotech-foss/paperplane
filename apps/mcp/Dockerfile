FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Dependencies first, so a code change does not refetch them.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-install-project --no-dev

COPY plane_mcp/ ./plane_mcp/
RUN uv sync --locked --no-dev


FROM python:3.12-slim

RUN groupadd --system --gid 1000 plane \
    && useradd --system --uid 1000 --gid plane --create-home plane

WORKDIR /app

COPY --from=builder --chown=plane:plane /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    FASTMCP_PORT=8211

USER plane

EXPOSE 8211

ENTRYPOINT ["python", "-m", "plane_mcp"]
CMD ["http"]
