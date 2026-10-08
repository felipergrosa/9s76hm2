// Gestão de sessões whatsmeow: um número pareado = um client.
package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	_ "github.com/mattn/go-sqlite3"
)

// Session descreve uma sessão pareada (ou em pareamento).
type Session struct {
	ID        string `json:"id"`        // JID do dispositivo ou id temporário de pareamento
	Label     string `json:"label"`
	CompanyID int    `json:"companyId"` // tenant do backend principal
	// WhatsappID: conexão (Whatsapp.id) do backend associada — vai no CallLog
	WhatsappID int    `json:"whatsappId,omitempty"`
	JID       string `json:"jid,omitempty"`
	Connected bool   `json:"connected"`
	client    *whatsmeow.Client
}

// SessionManager mantém os clients whatsmeow em memória.
type SessionManager struct {
	cfg      *Config
	log      waLog.Logger
	container *sqlstore.Container

	mu       sync.RWMutex
	sessions map[string]*Session // key = JID do dispositivo (string)

	// sessões em pareamento: key = id temporário, chan recebe o QR "code"
	pendingMu sync.Mutex
	pendingQR map[string]chan string

	// canal para encaminhar eventos de chamada ao calls tracker
	callEvents chan callEvent
}

func NewSessionManager(ctx context.Context, cfg Config, log waLog.Logger) (*SessionManager, error) {
	dbLog := waLog.Stdout("wacalls-db", "WARN", true)
	container, err := sqlstore.New(ctx, "sqlite3", cfg.SessionDB, dbLog)
	if err != nil {
		return nil, fmt.Errorf("sqlstore: %w", err)
	}
	return &SessionManager{
		cfg:        &cfg,
		log:        log,
		container:  container,
		sessions:   map[string]*Session{},
		pendingQR:  map[string]chan string{},
		callEvents: make(chan callEvent, 256),
	}, nil
}

// RestoreAll reconecta todos os devices já pareados persistidos no store.
func (m *SessionManager) RestoreAll(ctx context.Context) error {
	devices, err := m.container.GetAllDevices(ctx)
	if err != nil {
		return err
	}
	for _, ds := range devices {
		m.attach(ctx, ds)
	}
	m.log.Infof("%d sessão(ões) restaurada(s)", len(devices))
	return nil
}

// attach cria o client para um device já pareado e registra o handler.
func (m *SessionManager) attach(ctx context.Context, ds *store.Device) *Session {
	clientLog := waLog.Stdout("wacalls-client", m.cfg.LogLevel, true)
	client := whatsmeow.NewClient(ds, clientLog)
	s := &Session{
		ID:    ds.ID.String(),
		JID:   ds.ID.String(),
		client: client,
	}
	client.AddEventHandler(m.eventHandler(s))

	m.mu.Lock()
	m.sessions[s.ID] = s
	m.mu.Unlock()

	if err := client.Connect(); err != nil {
		m.log.Warnf("Sessão %s falhou ao conectar: %v", s.ID, err)
	} else {
		s.Connected = true
	}
	return s
}

// StartPairing inicia pareamento por QR para uma nova sessão.
// Retorna o channel que entregará o código QR (string) e o id temporário.
func (m *SessionManager) StartPairing(ctx context.Context, companyID int, whatsappID int, label string) (string, <-chan string, error) {
	ds := m.container.NewDevice()
	clientLog := waLog.Stdout("wacalls-client", m.cfg.LogLevel, true)
	client := whatsmeow.NewClient(ds, clientLog)

	qrChan, err := client.GetQRChannel(ctx)
	if err != nil {
		return "", nil, err
	}
	if err := client.Connect(); err != nil {
		return "", nil, err
	}

	pairID := fmt.Sprintf("pair-%d", time.Now().UnixNano())
	out := make(chan string, 4)

	m.pendingMu.Lock()
	m.pendingQR[pairID] = out
	m.pendingMu.Unlock()

	s := &Session{ID: pairID, Label: label, CompanyID: companyID, WhatsappID: whatsappID, client: client}
	client.AddEventHandler(m.eventHandler(s))

	// A sessão temporária entra no mapa já com a key pairID — PairWithPhone
	// e o promote (após sucesso do QR) a localizam por ela.
	m.mu.Lock()
	m.sessions[pairID] = s
	m.mu.Unlock()

	go func() {
		for evt := range qrChan {
			if evt.Event == "code" {
				out <- evt.Code
			}
			if evt.Event == "success" {
				m.promotePending(s)
				break
			}
		}
	}()
	return pairID, out, nil
}

// PairWithPhone pareamento por código (alternativa ao QR).
func (m *SessionManager) PairWithPhone(ctx context.Context, pairID, phone string) (string, error) {
	m.mu.RLock()
	// sessão temporária criada pelo StartPairing carrega o client
	s := m.pendingSession(pairID)
	m.mu.RUnlock()
	if s == nil {
		return "", fmt.Errorf("sessão de pareamento não encontrada")
	}
	code, err := s.client.PairPhone(ctx, phone, true, whatsmeow.PairClientChrome, "9s76hm2 Wacalls")
	if err != nil {
		return "", err
	}
	return code, nil
}

func (m *SessionManager) pendingSession(pairID string) *Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[pairID]
}

// promotePending move a sessão de "pair-*" para a key do JID após sucesso.
func (m *SessionManager) promotePending(s *Session) {
	jid := s.client.Store.ID.String()
	m.mu.Lock()
	delete(m.sessions, s.ID)
	s.ID = jid
	s.JID = jid
	s.Connected = true
	m.sessions[jid] = s
	m.mu.Unlock()
	m.log.Infof("Sessão pareada: %s", jid)
}

// List retorna snapshot das sessões.
func (m *SessionManager) List() []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		out = append(out, s)
	}
	return out
}

// Delete desconecta e remove a sessão do store.
func (m *SessionManager) Delete(ctx context.Context, id string) error {
	m.mu.Lock()
	s, ok := m.sessions[id]
	if ok {
		delete(m.sessions, id)
	}
	m.mu.Unlock()
	if !ok {
		return fmt.Errorf("sessão não encontrada")
	}
	s.client.Disconnect()
	if s.client.Store.ID != nil {
		return s.client.Logout(ctx)
	}
	return nil
}

// GetByJID retorna a sessão de um JID.
func (m *SessionManager) GetByJID(jid string) *Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.sessions[jid]
}

// Shutdown desconecta tudo.
func (m *SessionManager) Shutdown() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, s := range m.sessions {
		s.client.Disconnect()
	}
}

// ---------------------------------------------------------------------------
// Eventos

// callEvent normalizado para o tracker/relatório.
type callEvent struct {
	Session *Session
	Kind    string // "offer" | "accept" | "terminate" | "reject" | "notice"
	CallID  string
	From    string // JID de quem chama
	IsVideo bool
	Reason  string // terminate/reject
	When    int64  // unix
}

func (m *SessionManager) eventHandler(s *Session) func(interface{}) {
	return func(evt interface{}) {
		switch evt.(type) {
		case *events.Connected:
			s.Connected = true
			m.log.Infof("Sessão %s conectada", s.ID)
		case *events.Disconnected:
			s.Connected = false
			m.log.Warnf("Sessão %s desconectada", s.ID)
		default:
			if ce := mapCallEvent(s, evt); ce != nil {
				select {
				case m.callEvents <- *ce:
				default:
					m.log.Warnf("callEvents cheio — evento descartado")
				}
			}
		}
	}
}
