FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=
ARG VITE_ENABLE_DEMO_MODE=false
ARG VITE_ALLOW_DEMO_PREFILL=false
ARG VITE_ENABLE_ASSISTANT=false
ARG VITE_ENABLE_KNOWLEDGE_BASE=false
ARG VITE_ENABLE_PUBLIC_SAMPLE_INVITES=false
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN set -a \
  && if [ -f .env.production ]; then . ./.env.production; fi \
  && set +a \
  && npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
