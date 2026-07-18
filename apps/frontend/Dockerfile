FROM node:20-alpine

WORKDIR /workspace

COPY packages/contracts/package*.json packages/contracts/
RUN npm --prefix packages/contracts install
COPY packages/contracts packages/contracts
RUN npm --prefix packages/contracts run build

COPY apps/frontend/package*.json apps/frontend/
RUN npm --prefix apps/frontend install
COPY apps/frontend apps/frontend

WORKDIR /workspace/apps/frontend

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
