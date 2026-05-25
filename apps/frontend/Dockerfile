FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build and serve the production build. Render will run the container and expose the port.
EXPOSE 5173

# At container start: build the app and run Vite preview on 0.0.0.0
CMD ["sh", "-lc", "npm run build && npm run preview -- --host 0.0.0.0 --port 5173"]
