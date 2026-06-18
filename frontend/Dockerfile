FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# The built static assets live in /dist — copied into the backend image's
# /app/static (see docker-compose volume) or extracted via --target export.
FROM scratch AS export
COPY --from=build /app/dist /dist
