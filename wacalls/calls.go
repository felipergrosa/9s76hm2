// Eventos de chamada: mapeamento dos eventos whatsmeow + agregação
// (offer→término) e envio do resultado ao backend principal (/call-logs).
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// ---------------------------------------------------------------------------
// Mapeamento dos eventos brutos do whatsmeow para callEvent normalizado
// ---------------------------------------------------------------------------

// mapCallEvent converte eventos do whatsmeow em callEvent.
// Retorna nil para eventos que não são de chamada.
//
// NOTA (API whatsmeow): os campos usados (CallID/From/Timestamp/Reason) vêm de
// types.BasicCallMeta / CallTerminationReason. Se a versão do whatsmeow
// divergir, ajustar aqui — este é o ÚNICO ponto de acoplamento.
func mapCallEvent(s *Session, evt interface{}) *callEvent {
	switch v := evt.(type) {

	case *events.CallOffer:
		return &callEvent{
			Session: s,
			Kind:    "offer",
			CallID:  v.CallID,
			From:    v.From.String(),
			IsVideo: callOfferIsVideo(v),
			When:    v.Timestamp.Unix(),
		}

	case *events.CallOfferNotice:
		// Chamada em grupo/offline — tratar como oferta para notificação
		return &callEvent{
			Session: s,
			Kind:    "notice",
			CallID:  v.CallID,
			From:    v.From.String(),
			When:    v.Timestamp.Unix(),
		}

	case *events.CallAccept:
		return &callEvent{
			Session: s,
			Kind:    "accept",
			CallID:  v.CallID,
			From:    v.From.String(),
			When:    v.Timestamp.Unix(),
		}

	case *events.CallTerminate:
		return &callEvent{
			Session: s,
			Kind:    "terminate",
			CallID:  v.CallID,
			From:    v.From.String(),
			Reason:  string(v.Reason),
			When:    v.Timestamp.Unix(),
		}

	case *events.CallReject:
		return &callEvent{
			Session: s,
			Kind:    "reject",
			CallID:  v.CallID,
			From:    v.From.String(),
			Reason:  string(v.Reason),
			When:    v.Timestamp.Unix(),
		}
	}
	return nil
}

// callOfferIsVideo inspeciona o node da oferta procurando trilha de vídeo.
// Heurística: whatsmeow entrega o node `offer` bruto em v.Data — procuramos
// um filho <video> ou <media>. Ajustar conforme a versão do whatsmeow.
func callOfferIsVideo(v *events.CallOffer) bool {
	if v.Data == nil {
		return false
	}
	for _, child := range v.Data.GetChildren() {
		if child.Tag == "video" {
			return true
		}
	}
	return false
}

// ---------------------------------------------------------------------------
// Tracker: agrega offer→(accept|terminate|reject) e envia 1 log por chamada
// ---------------------------------------------------------------------------

type openCall struct {
	session   *Session
	callID    string
	from      string
	isVideo   bool
	startedAt time.Time
	answered  bool
}

// CallTracker consome callEvents, mantém chamadas abertas em memória e
// grava o resultado final no backend principal (POST /call-logs).
type CallTracker struct {
	cfg *Config
	log interface {
		Infof(string, ...interface{})
		Warnf(string, ...interface{})
		Errorf(string, ...interface{})
	}

	mu    sync.Mutex
	open  map[string]*openCall // key = callID
	httpC *http.Client
}

func NewCallTracker(cfg *Config, log waLogger) *CallTracker {
	return &CallTracker{
		cfg:   cfg,
		log:   log,
		open:  map[string]*openCall{},
		httpC: &http.Client{Timeout: 10 * time.Second},
	}
}

type waLogger interface {
	Infof(string, ...interface{})
	Warnf(string, ...interface{})
	Errorf(string, ...interface{})
}

// Run processa o canal de eventos até o contexto ser cancelado.
func (t *CallTracker) Run(ctx context.Context, events <-chan callEvent) {
	// sweeper: chamadas que nunca terminam (queda de rede) expiram em 10min
	go t.sweeper(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case evt := <-events:
			t.handle(ctx, evt)
		}
	}
}

func (t *CallTracker) handle(ctx context.Context, evt callEvent) {
	t.mu.Lock()
	defer t.mu.Unlock()

	switch evt.Kind {
	case "offer", "notice":
		t.open[evt.CallID] = &openCall{
			session:   evt.Session,
			callID:    evt.CallID,
			from:      evt.From,
			isVideo:   evt.IsVideo,
			startedAt: time.Unix(evt.When, 0),
		}
		// Notifica o backend/frontend em tempo real (chamada recebida)
		t.notifyIncoming(evt)

	case "accept":
		if oc := t.open[evt.CallID]; oc != nil {
			oc.answered = true
		}

	case "terminate", "reject":
		oc := t.open[evt.CallID]
		if oc == nil {
			return
		}
		delete(t.open, evt.CallID)
		t.report(oc, evt)
	}
}

// sweeper expira chamadas abertas há mais de 10min sem término.
func (t *CallTracker) sweeper(ctx context.Context) {
	tick := time.NewTicker(2 * time.Minute)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			t.mu.Lock()
			for id, oc := range t.open {
				if time.Since(oc.startedAt) > 10*time.Minute {
					delete(t.open, id)
					t.report(oc, callEvent{Kind: "terminate", Reason: "timeout", When: time.Now().Unix()})
				}
			}
			t.mu.Unlock()
		}
	}
}

// report envia o resultado da chamada para POST /call-logs do backend.
func (t *CallTracker) report(oc *openCall, end callEvent) {
	status := "answered"
	if !oc.answered {
		status = "missed"
		if end.Reason == "reject" || end.Kind == "reject" {
			status = "rejected"
		}
	}

	payload := map[string]interface{}{
		"companyId":       oc.session.CompanyID,
		"whatsappId":      oc.session.WhatsappID,
		"number":          jidToNumber(oc.from),
		"direction":       "in",
		"status":          status,
		"startedAt":       oc.startedAt.UTC().Format(time.RFC3339),
		"endedAt":         time.Unix(end.When, 0).UTC().Format(time.RFC3339),
		"durationSeconds": int64(time.Unix(end.When, 0).Sub(oc.startedAt).Seconds()),
		"provider":        "wacalls",
	}
	t.post("/call-logs", payload)
}

// notifyIncoming avisa o backend sobre chamada recebida (ticket/notificação).
// Endpoint sugerido: POST /call-logs/incoming (a implementar no backend se
// quiser push em tempo real — hoje o relatório já cobre o histórico).
func (t *CallTracker) notifyIncoming(evt callEvent) {
	t.post("/call-logs/incoming", map[string]interface{}{
		"companyId":  evt.Session.CompanyID,
		"whatsappId": evt.Session.WhatsappID,
		"callId":     evt.CallID,
		"number":     jidToNumber(evt.From),
		"isVideo":    evt.IsVideo,
		"at":         time.Unix(evt.When, 0).UTC().Format(time.RFC3339),
	})
}

func (t *CallTracker) post(path string, payload map[string]interface{}) {
	body, err := json.Marshal(payload)
	if err != nil {
		t.log.Errorf("marshal call-log: %v", err)
		return
	}
	req, err := http.NewRequest("POST", t.cfg.BackendURL+path, bytes.NewReader(body))
	if err != nil {
		t.log.Errorf("call-log req: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Token", t.cfg.ServiceToken)

	resp, err := t.httpC.Do(req)
	if err != nil {
		t.log.Warnf("call-log POST %s falhou: %v", path, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		t.log.Warnf("call-log POST %s -> %d", path, resp.StatusCode)
	}
}

// jidToNumber extrai o dígito do JID (5511...@s.whatsapp.net → 5511...).
func jidToNumber(jid string) string {
	for i, c := range jid {
		if c == '@' || c == ':' {
			return jid[:i]
		}
	}
	return jid
}

// RejectCall rejeita uma chamada em andamento (ação do atendente).
// NOTA: a assinatura de client.RejectCall varia conforme a versão do
// whatsmeow — em versões recentes é RejectCall(ctx, callFrom, callID).
func (t *CallTracker) rejectCall(ctx context.Context, s *Session, fromJID, callID string) error {
	jid, err := types.ParseJID(fromJID)
	if err != nil {
		return err
	}
	return s.client.RejectCall(ctx, jid, callID)
}
