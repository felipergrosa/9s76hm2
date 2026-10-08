// wacalls — microserviço de sessões WhatsApp (whatsmeow) para chamadas.
//
// Responsável por:
//   - parear números (QR code ou código de pareamento) — uma sessão por número
//   - detectar eventos de chamada do protocolo (oferta/aceite/término)
//   - reportar chamadas ao backend principal via POST /call-logs
//   - expor eventos de chamada por SSE/WebSocket para o frontend atender
//
// NÃO faz (fora de escopo do skeleton): bridge de mídia RTP↔WebRTC
// (áudio/vídeo real). Ver docs/privado/WACALLS.md.
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	waLog "go.mau.fi/whatsmeow/util/log"
)

func main() {
	_ = godotenv.Load()

	cfg := loadConfig()

	log := waLog.Stdout("wacalls", cfg.LogLevel, true)
	log.Infof("Iniciando wacalls em %s (backend=%s)", cfg.ListenAddr, cfg.BackendURL)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mgr, err := NewSessionManager(ctx, cfg, log)
	if err != nil {
		log.Errorf("Falha ao abrir store de sessões: %v", err)
		os.Exit(1)
	}

	// Reconecta sessões já pareadas
	if err := mgr.RestoreAll(ctx); err != nil {
		log.Warnf("Restore de sessões com avisos: %v", err)
	}

	// Tracker de chamadas: consome os eventos e reporta ao backend
	tracker := NewCallTracker(&cfg, log)
	go tracker.Run(ctx, mgr.callEvents)

	srv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      NewAPI(cfg, mgr, log),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		log.Infof("Desligando...")
		cancel()
		shutdownCtx, c2 := context.WithTimeout(context.Background(), 10*time.Second)
		defer c2()
		_ = srv.Shutdown(shutdownCtx)
		mgr.Shutdown()
	}()

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Fprintf(os.Stderr, "http: %v\n", err)
		os.Exit(1)
	}
}
