FROM node:20-alpine AS builder

WORKDIR /app

# VITE_API_URL is baked into the bundle at build time — must be an ARG not ENV-only
ARG VITE_API_URL=http://localhost:8008
ENV VITE_API_URL=$VITE_API_URL

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.25-alpine AS runner

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
