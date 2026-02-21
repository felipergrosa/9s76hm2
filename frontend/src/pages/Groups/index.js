import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import { useHistory } from "react-router-dom";
import {
    Search,
    Users,
    MessageSquare,
    RefreshCw,
    Eye,
    Wifi,
    WifiOff,
    Download,
} from "lucide-react";
import { toast } from "react-toastify";
import api from "../../services/api";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import useDebounce from "../../hooks/useDebounce";
import ContactAvatar from "../../components/ContactAvatar";

// Cores para os headers das lanes (cicla entre elas)
const LANE_COLORS = [
    { bg: "#00a884", text: "#fff" },    // verde WhatsApp
    { bg: "#5b5ea6", text: "#fff" },    // roxo
    { bg: "#e67e22", text: "#fff" },    // laranja
    { bg: "#2980b9", text: "#fff" },    // azul
    { bg: "#c0392b", text: "#fff" },    // vermelho
    { bg: "#16a085", text: "#fff" },    // teal
    { bg: "#8e44ad", text: "#fff" },    // violeta
    { bg: "#d35400", text: "#fff" },    // dark orange
];

const Groups = () => {
    const history = useHistory();
    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const debouncedSearchParam = useDebounce(searchParam, 400);
    const [groups, setGroups] = useState([]);
    const [totalGroups, setTotalGroups] = useState(0);
    const requestIdRef = useRef(0);

    // Buscar todos os grupos (sem paginação, agrupamos no frontend)
    useEffect(() => {
        setLoading(true);
        const currentId = ++requestIdRef.current;

        const fetchGroups = async () => {
            try {
                const { data } = await api.get("/groups", {
                    params: {
                        searchParam: debouncedSearchParam,
                        pageNumber: 1,
                        limit: 500, // Trazer todos para agrupar por conexão
                    },
                });

                if (currentId !== requestIdRef.current) return;

                setGroups(data.groups || []);
                setTotalGroups(data.count || 0);
            } catch (err) {
                toastError(err);
            } finally {
                if (currentId === requestIdRef.current) setLoading(false);
            }
        };

        fetchGroups();
    }, [debouncedSearchParam]);

    // Agrupar grupos por conexão (whatsappId)
    const lanes = useMemo(() => {
        const map = {};

        groups.forEach((group) => {
            const wId = group.whatsappId || 0;
            if (!map[wId]) {
                map[wId] = {
                    whatsappId: wId,
                    whatsappName: group.whatsapp?.name || "Sem conexão",
                    whatsappNumber: group.whatsapp?.number || "",
                    whatsappStatus: group.whatsapp?.status || "DISCONNECTED",
                    groups: [],
                };
            }
            map[wId].groups.push(group);
        });

        // Ordenar os grupos dentro de cada lane por data da última mensagem (DESC)
        Object.values(map).forEach(lane => {
            lane.groups.sort((a, b) => new Date(b.lastMessageDate) - new Date(a.lastMessageDate));
        });

        // Ordenar lanes pelo nome da conexão
        return Object.values(map).sort((a, b) =>
            a.whatsappName.localeCompare(b.whatsappName)
        );
    }, [groups]);

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase());
    };

    const handleRefresh = () => {
        setGroups([]);
        setTotalGroups(0);
        // Forçar re-fetch
        requestIdRef.current++;
        const currentId = ++requestIdRef.current;
        setLoading(true);

        const fetchGroups = async () => {
            try {
                const { data } = await api.get("/groups", {
                    params: {
                        searchParam: debouncedSearchParam,
                        pageNumber: 1,
                        limit: 500,
                    },
                });
                if (currentId !== requestIdRef.current) return;
                setGroups(data.groups || []);
                setTotalGroups(data.count || 0);
            } catch (err) {
                toastError(err);
            } finally {
                if (currentId === requestIdRef.current) setLoading(false);
            }
        };
        fetchGroups();
    };

    const handleOpenTicket = async (groupId) => {
        try {
            const { data: ticket } = await api.post("/tickets", {
                contactId: groupId,
                userId: user?.id,
                status: "group",
            });
            history.push(`/tickets/${ticket.uuid}`);
        } catch (err) {
            toastError(err);
        }
    };

    // Sincronizar todos os grupos do WhatsApp para o sistema
    const handleSyncGroups = async () => {
        setSyncing(true);
        try {
            // Buscar todas as conexões WhatsApp
            const { data: whatsapps } = await api.get("/whatsapp");
            const connections = whatsapps || [];
            const connected = connections.filter(w => w.status === "CONNECTED");

            if (connected.length === 0) {
                toast.warn("Nenhuma conexão WhatsApp ativa encontrada.");
                setSyncing(false);
                return;
            }

            let totalSynced = 0;
            let totalCreated = 0;

            for (const conn of connected) {
                try {
                    const { data } = await api.post(`/wbot/${conn.id}/groups/sync`);
                    totalSynced += data.total || 0;
                    totalCreated += data.ticketsCreated || 0;
                } catch (err) {
                    console.warn(`Erro ao sincronizar grupos da conexão ${conn.name}:`, err);
                }
            }

            toast.success(`Sincronização concluída: ${totalSynced} grupos encontrados, ${totalCreated} novos importados.`);
            // Recarregar lista
            handleRefresh();
        } catch (err) {
            toastError(err);
        } finally {
            setSyncing(false);
        }
    };

    const canViewGroups = user.allowGroup || user.profile === "admin" || user.super;

    const isConnected = (status) =>
        status === "CONNECTED" || status === "qrcode" || status === "OPENING";

    return (
        <MainContainer>
            {canViewGroups ? (
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    backgroundColor: "#f0f2f5",
                }}>
                    {/* Header */}
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "12px 16px",
                        backgroundColor: "#fff",
                        borderBottom: "1px solid #e0e0e0",
                        flexWrap: "wrap",
                        gap: 8,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Users size={22} color="#00a884" />
                            <span style={{ fontSize: 18, fontWeight: 600, color: "#111b21" }}>
                                Grupos do WhatsApp
                            </span>
                            <span style={{
                                padding: "2px 10px",
                                fontSize: 12,
                                fontWeight: 500,
                                backgroundColor: "#e8f5e9",
                                color: "#2e7d32",
                                borderRadius: 12,
                            }}>
                                {totalGroups} grupos
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ position: "relative" }}>
                                <Search
                                    size={16}
                                    color="#8696a0"
                                    style={{
                                        position: "absolute",
                                        left: 10,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                    }}
                                />
                                <input
                                    type="text"
                                    placeholder="Buscar grupos..."
                                    value={searchParam}
                                    onChange={handleSearch}
                                    style={{
                                        width: 240,
                                        height: 36,
                                        paddingLeft: 34,
                                        paddingRight: 12,
                                        fontSize: 13,
                                        border: "1px solid #d1d5db",
                                        borderRadius: 8,
                                        outline: "none",
                                        backgroundColor: "#fff",
                                    }}
                                />
                            </div>
                            <button
                                onClick={handleRefresh}
                                title="Atualizar lista"
                                disabled={loading}
                                style={{
                                    padding: 8,
                                    border: "none",
                                    background: "transparent",
                                    cursor: loading ? "not-allowed" : "pointer",
                                    borderRadius: 8,
                                    display: "flex",
                                    alignItems: "center",
                                }}
                            >
                                <RefreshCw size={18} color="#667781" />
                            </button>
                            <button
                                onClick={handleSyncGroups}
                                title="Sincronizar grupos do WhatsApp"
                                disabled={syncing}
                                style={{
                                    padding: "6px 12px",
                                    border: "1px solid #00a884",
                                    background: syncing ? "#e8f5e9" : "#fff",
                                    cursor: syncing ? "not-allowed" : "pointer",
                                    borderRadius: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    color: "#00a884",
                                }}
                            >
                                <Download size={16} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
                                {syncing ? "Sincronizando..." : "Sincronizar"}
                            </button>
                        </div>
                    </div>

                    {/* Kanban Lanes */}
                    <div style={{
                        flex: 1,
                        overflowX: "auto",
                        overflowY: "hidden",
                        padding: 16,
                        display: "flex",
                        gap: 16,
                        alignItems: "flex-start",
                    }}>
                        {loading ? (
                            // Skeleton de lanes
                            [...Array(3)].map((_, i) => (
                                <div key={i} style={{
                                    minWidth: 320,
                                    maxWidth: 320,
                                    backgroundColor: "#fff",
                                    borderRadius: 12,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                                    overflow: "hidden",
                                }}>
                                    <div style={{
                                        height: 48,
                                        backgroundColor: "#e0e0e0",
                                        borderRadius: "12px 12px 0 0",
                                        animation: "pulse 1.5s infinite",
                                    }} />
                                    {[...Array(4)].map((_, j) => (
                                        <div key={j} style={{
                                            margin: "8px 12px",
                                            height: 72,
                                            backgroundColor: "#f5f5f5",
                                            borderRadius: 8,
                                            animation: "pulse 1.5s infinite",
                                        }} />
                                    ))}
                                </div>
                            ))
                        ) : lanes.length === 0 ? (
                            <div style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "100%",
                                padding: 40,
                                color: "#8696a0",
                            }}>
                                <Users size={48} color="#d1d5db" style={{ marginBottom: 12 }} />
                                <p style={{ fontSize: 16, fontWeight: 500 }}>Nenhum grupo encontrado</p>
                                <p style={{ fontSize: 13 }}>
                                    {searchParam
                                        ? "Tente uma busca diferente"
                                        : "Os grupos do WhatsApp aparecerão aqui"}
                                </p>
                            </div>
                        ) : (
                            lanes.map((lane, laneIdx) => {
                                const color = LANE_COLORS[laneIdx % LANE_COLORS.length];
                                return (
                                    <div key={lane.whatsappId} style={{
                                        minWidth: 320,
                                        maxWidth: 320,
                                        display: "flex",
                                        flexDirection: "column",
                                        maxHeight: "100%",
                                        backgroundColor: "#fff",
                                        borderRadius: 12,
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                                        overflow: "hidden",
                                        flexShrink: 0,
                                    }}>
                                        {/* Header da lane */}
                                        <div style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "10px 14px",
                                            backgroundColor: color.bg,
                                            color: color.text,
                                        }}>
                                            <div style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                                flex: 1,
                                                minWidth: 0,
                                            }}>
                                                {isConnected(lane.whatsappStatus) ? (
                                                    <Wifi size={16} />
                                                ) : (
                                                    <WifiOff size={16} style={{ opacity: 0.7 }} />
                                                )}
                                                <span style={{
                                                    fontWeight: 600,
                                                    fontSize: 14,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {lane.whatsappName}
                                                </span>
                                                {lane.whatsappNumber && (
                                                    <span style={{
                                                        fontSize: 11,
                                                        opacity: 0.8,
                                                        whiteSpace: "nowrap",
                                                    }}>
                                                        {lane.whatsappNumber}
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{
                                                backgroundColor: "rgba(255,255,255,0.25)",
                                                padding: "2px 8px",
                                                borderRadius: 10,
                                                fontSize: 12,
                                                fontWeight: 600,
                                                whiteSpace: "nowrap",
                                            }}>
                                                {lane.groups.length}
                                            </span>
                                        </div>

                                        {/* Lista de grupos na lane */}
                                        <div style={{
                                            flex: 1,
                                            overflowY: "auto",
                                            padding: "8px 8px 12px",
                                        }}>
                                            {lane.groups.map((group) => (
                                                <div
                                                    key={group.id}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                        padding: "10px 10px",
                                                        marginBottom: 6,
                                                        borderRadius: 8,
                                                        border: "1px solid #f0f0f0",
                                                        backgroundColor: "#fafafa",
                                                        cursor: "pointer",
                                                        transition: "all 0.15s",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = "#f0f7f4";
                                                        e.currentTarget.style.borderColor = "#c8e6c9";
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = "#fafafa";
                                                        e.currentTarget.style.borderColor = "#f0f0f0";
                                                    }}
                                                    onClick={() => handleOpenTicket(group.id)}
                                                >
                                                    <ContactAvatar contact={group} size={40} />
                                                    <div style={{
                                                        flex: 1,
                                                        minWidth: 0,
                                                        overflow: "hidden",
                                                    }}>
                                                        <div style={{
                                                            fontWeight: 500,
                                                            fontSize: 13,
                                                            color: "#111b21",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            {group.name || "Grupo sem nome"}
                                                        </div>
                                                        <div style={{
                                                            fontSize: 11,
                                                            color: "#8696a0",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}>
                                                            {group.number}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "flex-end",
                                                        gap: 6,
                                                    }}>
                                                        {parseInt(group.unreadCount) > 0 && (
                                                            <div style={{
                                                                backgroundColor: "#25d366",
                                                                color: "white",
                                                                minWidth: 20,
                                                                height: 20,
                                                                borderRadius: 10,
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontSize: 11,
                                                                fontWeight: "bold",
                                                                padding: "0 6px",
                                                            }}>
                                                                {group.unreadCount}
                                                            </div>
                                                        )}
                                                        <div style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: 4,
                                                        }}>
                                                            <Eye size={14} color="#8696a0" />
                                                            <MessageSquare size={14} color="#00a884" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                }}>
                    <p style={{ color: "#8696a0" }}>Você não tem permissão para visualizar grupos.</p>
                </div>
            )}
        </MainContainer>
    );
};

export default Groups;
