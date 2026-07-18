FROM node:20-alpine

WORKDIR /workspace

COPY packages/contracts/package*.json packages/contracts/
RUN npm --prefix packages/contracts install
COPY packages/contracts packages/contracts
RUN npm --prefix packages/contracts run build

COPY apps/backend/package*.json apps/backend/
RUN npm --prefix apps/backend install
COPY apps/backend apps/backend

WORKDIR /workspace/apps/backend

EXPOSE 3001

CMD ["npm", "run", "dev"]
