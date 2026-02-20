FROM golang:1.25-alpine AS base
WORKDIR /app

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

FROM base AS dev
COPY . .
EXPOSE 8080
CMD ["go", "run", "./cmd/server"]

FROM base AS builder
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /bin/server ./cmd/server

FROM alpine:3.21 AS runtime
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=builder /bin/server /app/server
EXPOSE 8080
ENTRYPOINT ["/app/server"]
