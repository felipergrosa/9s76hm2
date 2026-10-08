package main

import "os"

// Configuração via env — ver .env.example.
type Config struct {
	// Endereço do listener HTTP desta API (ex.: ":8090")
	ListenAddr string

	// URL do backend principal (para POST /call-logs e callbacks de evento)
	BackendURL string

	// Token de serviço compartilhado com o backend (X-Service-Token).
	// Também autentica a API de gestão deste serviço.
	ServiceToken string

	// DSN do banco de sessões whatsmeow (sqlite por padrão).
	// Ex.: "file:wacalls.db?_foreign_keys=on" ou postgres DSN.
	SessionDB string

	// Nível de log whatsmeow (DEBUG/INFO/WARN/ERROR)
	LogLevel string
}

func loadConfig() Config {
	return Config{
		ListenAddr:   getEnv("LISTEN_ADDR", ":8090"),
		BackendURL:   getEnv("BACKEND_URL", "http://localhost:8080"),
		ServiceToken: os.Getenv("INTERNAL_SERVICE_TOKEN"),
		SessionDB:    getEnv("WACALLS_SESSION_DB", "file:wacalls.db?_foreign_keys=on"),
		LogLevel:     getEnv("LOG_LEVEL", "INFO"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
