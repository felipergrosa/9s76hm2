# Build sem Go local — compila no estágio builder.
FROM golang:1.22-alpine AS builder

WORKDIR /app
RUN apk add --no-cache gcc musl-dev # CGO exigido pelo sqlite3

COPY go.mod ./
# Resolve dependências (o placeholder de versão do whatsmeow é substituído aqui)
RUN go get go.mau.fi/whatsmeow@latest && \
    go get github.com/mattn/go-sqlite3@latest && \
    go get github.com/joho/godotenv@latest

COPY . .
RUN CGO_ENABLED=1 go build -o wacalls .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates sqlite-libs
WORKDIR /app
COPY --from=builder /app/wacalls .
COPY .env.example .env
EXPOSE 8090
CMD ["./wacalls"]
