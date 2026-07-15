# Multi-stage here, unlike the backend: the prod stage discards node_modules
# (~172MB) and ships only static files on nginx. The backend installs no
# compiler toolchain, so a builder stage there would discard nothing.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

FROM deps AS build
COPY . .
# Vite inlines VITE_* at build time, so this must arrive as a build arg --
# a runtime env var would never reach the bundle.
ARG VITE_API_BASE_URL=http://localhost:9004
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
