import {
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    WASocket,
    Contact as BaileysContact,
    GroupMetadata,
    proto,
    makeWASocket,
    jidNormalizedUser
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import path from "path";
import fs from "fs";
import "../bootstrap";

interface FullContactDiscovery {
    basic: {
        jid: string;
        exists: boolean;
        lid?: string;
        name?: string;
        notify?: string;
        verifiedName?: string;
        pushName?: string; // NOVO: Nome que aparece nas notificações
        status?: string;
        imgUrl?: string;
    };
    profile: {
        about?: string;
        aboutTag?: string;
        profilePicUrl?: string;
        profilePicUrlHD?: string;
    };
    business?: {
        wid: string;
        address?: string;
        description?: string;
        website?: string[];
        email?: string;
        category?: string;
        businessHours?: any;
        verifiedLevel?: string;
        verifiedName?: string; // NOVO: Nome verificado do Business
        catalogs?: any[];
        products?: any[];
    };
    metadata: {
        isBlocked?: boolean;
        isGroup?: boolean;
        isMyContact?: boolean;
        isPremium?: boolean;
        isEnterprise?: boolean;
        lastSeen?: number;
        isOnline?: boolean;
    };
    privacy?: {
        readreceipts?: string;
        profile?: string;
        status?: string;
        online?: string;
        last?: string;
        groupadd?: string;
        calladd?: string;
    };
    extra: {
        timestamp: string;
        rawData: any;
    };
}

class BaileysContactDiscovery {
    private sock: WASocket | null = null;
    private sessionPath: string;

    constructor(
        private whatsappId: string,
        private companyId: number,
        private basePath: string = "private/sessions"
    ) {
        this.sessionPath = path.resolve(
            process.cwd(),
            this.basePath,
            String(companyId),
            String(whatsappId)
        );
    }

    async initialize(): Promise<void> {
        console.log("🚀 Inicializando socket Baileys...");

        // Usar o helper customizado do Whaticket (compatível com driver FS/Redis)
        const { useMultiFileAuthState: useCustomAuthState } = require("../helpers/useMultiFileAuthState");

        // Simulação de objeto Whatsapp para o helper
        const mockWhatsapp = { id: Number(this.whatsappId), companyId: this.companyId };
        const { state: customState, saveCreds: customSaveCreds } = await useCustomAuthState(mockWhatsapp);

        const { version } = await fetchLatestBaileysVersion();

        this.sock = makeWASocket({
            version,
            auth: customState,
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: ["Whaticket", "Chrome", "10.0"],
            getMessage: async () => ({ conversation: "" }),
        });

        this.sock.ev.on("creds.update", customSaveCreds);

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Timeout ao conectar"));
            }, 30000);

            this.sock!.ev.on("connection.update", (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    clearTimeout(timeout);
                    console.log("✅ Conexão estabelecida!");
                    resolve();
                }

                if (connection === "close") {
                    const shouldReconnect =
                        (lastDisconnect?.error as Boom)?.output?.statusCode !==
                        DisconnectReason.loggedOut;

                    if (!shouldReconnect) {
                        clearTimeout(timeout);
                        reject(new Error("Desconectado"));
                    }
                }
            });
        });
    }

    async discoverContact(phoneNumber: string): Promise<FullContactDiscovery> {
        if (!this.sock) {
            throw new Error("Socket não inicializado");
        }

        const digits = phoneNumber.replace(/\D/g, "");
        const jid = `${digits}@s.whatsapp.net`;
        console.log(`\n🔍 Descobrindo informações de: ${digits}\n`);

        const discovery: FullContactDiscovery = {
            basic: { jid, exists: false },
            profile: {},
            metadata: {},
            extra: {
                timestamp: new Date().toISOString(),
                rawData: {},
            },
        };

        try {
            console.log("📱 Verificando existência...");
            const [onWhatsAppResult] = await this.sock.onWhatsApp(jid);
            if (onWhatsAppResult) {
                discovery.basic.exists = !!onWhatsAppResult.exists;
                discovery.basic.lid = (onWhatsAppResult as any).lid;
                console.log(`✅ Contato existe: ${onWhatsAppResult.exists}`);
            }

            console.log("🖼️  Buscando foto de perfil...");
            try {
                const profilePicUrl = await this.sock.profilePictureUrl(jid, "image");
                discovery.profile.profilePicUrl = profilePicUrl;
                console.log(`✅ Foto encontrada`);

                try {
                    const profilePicUrlHD = await this.sock.profilePictureUrl(jid, "preview");
                    discovery.profile.profilePicUrlHD = profilePicUrlHD;
                } catch { }
            } catch (error) {
                console.log("⚠️  Sem foto de perfil ou privacidade ativa");
            }

            console.log("📝 Buscando status/about...");
            try {
                const status = await this.sock.fetchStatus(jid) as any;
                if (status && status.status) {
                    discovery.profile.about = status.status;
                    discovery.profile.aboutTag = status.setAt
                        ? new Date(Number(status.setAt) * 1000).toISOString()
                        : undefined;
                    console.log(`✅ Status: "${status.status}"`);
                }
            } catch (error) {
                console.log("⚠️  Status não disponível (privacidade)");
            }

            console.log("🏢 Buscando dados comerciais...");
            try {
                const businessProfile = await this.sock.getBusinessProfile(jid);
                if (businessProfile) {
                    discovery.business = {
                        wid: businessProfile.wid || jid,
                        address: businessProfile.address,
                        description: businessProfile.description,
                        website: businessProfile.website,
                        email: businessProfile.email,
                        category: businessProfile.category,
                        businessHours: businessProfile.business_hours,
                        verifiedLevel: (businessProfile as any).verified_level,
                        verifiedName: (businessProfile as any).verified_name,
                    };

                    if ((businessProfile as any).verified_name) {
                        discovery.basic.verifiedName = (businessProfile as any).verified_name;
                        console.log(`✅ Nome Verificado (Business): "${discovery.basic.verifiedName}"`);
                    }

                    console.log(`✅ Conta comercial: ${businessProfile.category}`);
                }
            } catch (error) {
                console.log("⚠️  Não é conta comercial");
            }

            console.log("👤 Buscando dados do contato salvo no store...");
            try {
                const store = (this.sock as any).store;
                const contact = store?.contacts?.[jid];
                if (contact) {
                    discovery.basic.name = contact.name;
                    discovery.basic.notify = contact.notify;
                    discovery.basic.pushName = (contact as any).pushName;

                    if (!discovery.basic.verifiedName) {
                        discovery.basic.verifiedName = contact.verifiedName;
                    }

                    discovery.metadata.isMyContact = true;

                    const displayName = contact.name || contact.notify || (contact as any).pushName || contact.verifiedName;
                    console.log(`✅ Nome encontrado no store: "${displayName}"`);
                }

                console.log("📨 Buscando pushName nas mensagens...");
                try {
                    const messages = store?.messages?.[jid];
                    if (messages && Array.isArray(messages)) {
                        for (const msg of messages) {
                            if (msg.key?.fromMe === false && (msg as any).pushName) {
                                discovery.basic.pushName = (msg as any).pushName;
                                console.log(`✅ pushName das mensagens: "${discovery.basic.pushName}"`);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.log("⚠️  Sem mensagens no cache");
                }

            } catch (e) {
                console.log("⚠️  Erro ao buscar do store:", (e as Error).message);
            }

            console.log("🔒 Buscando configurações de privacidade...");
            try {
                const privacySettings = await this.sock.fetchPrivacySettings();
                discovery.privacy = privacySettings as any;
                console.log("✅ Privacidade obtida");
            } catch {
                console.log("⚠️  Privacidade não disponível");
            }

            discovery.extra.rawData = {
                onWhatsApp: onWhatsAppResult,
                businessProfile: discovery.business,
                storeContact: (this.sock as any).store?.contacts?.[jid],
            };

            console.log("\n" + "=".repeat(60));
            console.log("📋 RESUMO DE NOMES ENCONTRADOS:");
            console.log("=".repeat(60));
            console.log(`pushName (notificação):  ${discovery.basic.pushName || "❌ Não encontrado"}`);
            console.log(`verifiedName (business):  ${discovery.basic.verifiedName || "❌ Não encontrado"}`);
            console.log(`name (cache):            ${discovery.basic.name || "❌ Não encontrado"}`);
            console.log(`notify (agenda):         ${discovery.basic.notify || "❌ Não encontrado"}`);
            console.log("=".repeat(60));

        } catch (error) {
            console.error("❌ Erro durante descoberta:", error);
            throw error;
        }

        return discovery;
    }

    async close(): Promise<void> {
        if (this.sock) {
            await this.sock.end(undefined);
            this.sock = null;
        }
    }
}

async function main() {
    const phoneNumber = process.argv[2];
    const whatsappId = process.argv[3] || "13";
    const companyId = process.argv[4] || "1";

    if (!phoneNumber) {
        console.error("❌ Uso: npx ts-node src/scripts/baileys_full_discovery.ts <numero> [whatsappId] [companyId]");
        process.exit(1);
    }

    const discovery = new BaileysContactDiscovery(
        whatsappId,
        parseInt(companyId)
    );

    try {
        await discovery.initialize();
        const result = await discovery.discoverContact(phoneNumber);

        console.log("\n" + "=".repeat(80));
        console.log("📊 RESULTADO COMPLETO DA DESCOBERTA");
        console.log("=".repeat(80));
        console.log(JSON.stringify(result, null, 2));
        console.log("=".repeat(80));

        const outputPath = path.resolve(process.cwd(), `discovery_${phoneNumber}_${Date.now()}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`\n💾 Resultado salvo em: ${outputPath}`);

    } catch (error) {
        console.error("❌ Erro:", error);
        process.exit(1);
    } finally {
        await discovery.close();
        process.exit(0);
    }
}

main();
