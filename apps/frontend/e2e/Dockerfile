FROM node:22-bookworm
WORKDIR /workspace
COPY packages/contracts/package*.json packages/contracts/
RUN npm --prefix packages/contracts ci
COPY packages/contracts packages/contracts
RUN npm --prefix packages/contracts run build
COPY apps/backend/package*.json apps/backend/
COPY apps/frontend/package*.json apps/frontend/
RUN npm --prefix apps/backend ci && npm --prefix apps/frontend ci
WORKDIR /workspace/apps/frontend
RUN npx playwright install --with-deps chromium
WORKDIR /workspace
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend
WORKDIR /workspace/apps/frontend
CMD ["npm", "run", "test:e2e"]
