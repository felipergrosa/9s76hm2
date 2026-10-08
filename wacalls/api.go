// API HTTP de gestão do wacalls.
//
// Endpoints (todos autenticados por X-Service-Token, exceto /health):
//   POST   /sessions                 {companyId, whatsappId, label} → inicia pareamento
//   GET    /sessions                 → lista sessões
//   GET    /sessions/:id/qr          → {qr: "..."} (polling até parear)
//   POST   /sessions/:id/pair-code   {phone} → código de 8 dígitos
//   POST   /sessions/:id/reject-call {callId, from} → rejeita chamada
//   DELETE /sessions/:id             → logout + remove
//   GET    /health                   → ok
package main

import (
	"encoding/json"
	"net/http"
	"strings"
)

type api struct {
	cfg *Config
	mgr *SessionManager
}

func NewAPI(cfg Config, mgr *SessionManager, log interface{ Infof(string, ...interface{}) }) http.Handler {
	a := &api{cfg: &cfg, mgr: mgr}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", a.health)
	mux.HandleFunc("/sessions", a.auth(a.sessions))
	mux.HandleFunc("/sessions/", a.auth(a.sessionSub))
	return mux
}

// auth exige X-Service-Token igual a INTERNAL_SERVICE_TOKEN.
func (a *api) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.cfg.ServiceToken == "" {
			writeJSON(w, 503, map[string]string{"error": "INTERNAL_SERVICE_TOKEN não configurado"})
			return
		}
		if r.Header.Get("X-Service-Token") != a.cfg.ServiceToken {
			writeJSON(w, 403, map[string]string{"error": "token inválido"})
			return
		}
		next(w, r)
	}
}

func (a *api) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]string{"status": "ok"})
}

func (a *api) sessions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, 200, a.mgr.List())
	case http.MethodPost:
		var body struct {
			CompanyID  int    `json:"companyId"`
			WhatsappID int    `json:"whatsappId"`
			Label      string `json:"label"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.CompanyID == 0 {
			writeJSON(w, 400, map[string]string{"error": "body inválido: {companyId, whatsappId, label}"})
			return
		}
		pairID, qrChan, err := a.mgr.StartPairing(r.Context(), body.CompanyID, body.WhatsappID, body.Label)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		// espera o primeiro QR code (até 60s)
		select {
		case code := <-qrChan:
			writeJSON(w, 201, map[string]string{"id": pairID, "qr": code})
		case <-r.Context().Done():
			writeJSON(w, 504, map[string]string{"error": "timeout aguardando QR"})
		}
	default:
		writeJSON(w, 405, nil)
	}
}

func (a *api) sessionSub(w http.ResponseWriter, r *http.Request) {
	// /sessions/:id[/sub]
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/sessions/"), "/")
	id := parts[0]
	sub := ""
	if len(parts) > 1 {
		sub = parts[1]
	}

	switch {
	case r.Method == http.MethodGet && sub == "qr":
		// reentrega o próximo QR do canal — simplificado: o skeleton
		// mantém o último código na sessão (implementar cache se necessário)
		writeJSON(w, 200, map[string]string{"id": id, "qr": "<ver POST /sessions>"})

	case r.Method == http.MethodPost && sub == "pair-code":
		var body struct{ Phone string `json:"phone"` }
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Phone == "" {
			writeJSON(w, 400, map[string]string{"error": "phone obrigatório (somente dígitos, ex.: 5511999998888)"})
			return
		}
		code, err := a.mgr.PairWithPhone(r.Context(), id, body.Phone)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]string{"code": code})

	case r.Method == http.MethodPost && sub == "reject-call":
		var body struct {
			CallID string `json:"callId"`
			From   string `json:"from"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, 400, nil)
			return
		}
		s := a.mgr.GetByJID(id)
		if s == nil {
			writeJSON(w, 404, map[string]string{"error": "sessão não encontrada"})
			return
		}
		// TODO: chamar tracker.rejectCall — a assinatura de RejectCall varia
		// conforme a versão do whatsmeow; ver calls.go.
		writeJSON(w, 501, map[string]string{"error": "reject-call pendente: bridge de sinalização"})

	case r.Method == http.MethodDelete && sub == "":
		if err := a.mgr.Delete(r.Context(), id); err != nil {
			writeJSON(w, 404, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]string{"status": "removida"})

	default:
		writeJSON(w, 404, nil)
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}
