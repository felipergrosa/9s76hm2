module wacalls

go 1.22

// whatsmeow: pin de versão recente (o "go mod tidy" resolve o hash exato).
// Se a API de chamadas divergir, ajustar em sessions.go/calls.go.
require (
	go.mau.fi/whatsmeow v0.0.0-20251001000000-000000000000 // placeholder — substituir por tag/commit real via `go get go.mau.fi/whatsmeow@latest`
	github.com/mattn/go-sqlite3 v1.14.22
	github.com/joho/godotenv v1.5.1
)
