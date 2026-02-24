import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  DataType,
  PrimaryKey,
  Default,
  BelongsTo,
  ForeignKey
} from "sequelize-typescript";
import Contact from "./Contact";
import Ticket from "./Ticket";
import Company from "./Company";
import Queue from "./Queue";
import TicketTraking from "./TicketTraking";

@Table
class Message extends Model<Message> {
  @PrimaryKey
  @Column
  id: number;

  @Column(DataType.STRING)
  remoteJid: string;

  @Column(DataType.STRING)
  participant: string;

  @Column(DataType.STRING)
  dataJson: string;

  @Default(0)
  @Column
  ack: number;

  @Default(false)
  @Column
  read: boolean;

  @Default(false)
  @Column
  fromMe: boolean;

  @Column(DataType.TEXT)
  body: string;

  @Column(DataType.TEXT)
  audioTranscription: string;

  @Column(DataType.STRING)
  get mediaUrl(): string | null {
    if (this.getDataValue("mediaUrl")) {
      const fileRel = this.getDataValue("mediaUrl");
      // Se já for uma URL absoluta (http/https), retorna como está
      if (/^https?:\/\//i.test(fileRel)) {
        return fileRel;
      }

      // Determinar caminho relativo do arquivo
      let filePath: string;
      if (fileRel.includes('/')) {
        // Já contém subpasta (ex: contact1676/arquivo.jpg)
        filePath = fileRel;
      } else {
        // Só nome do arquivo — verificar onde realmente está no disco
        // Tentar primeiro na subpasta contact{id}/, depois direto na raiz da company
        const fs = require('fs');
        const pathModule = require('path');
        const companyDir = pathModule.resolve(__dirname, '..', '..', 'public', `company${this.companyId}`);
        const inSubfolder = pathModule.join(companyDir, `contact${this.contactId}`, fileRel);
        const inRoot = pathModule.join(companyDir, fileRel);

        if (this.contactId && fs.existsSync(inSubfolder)) {
          filePath = `contact${this.contactId}/${fileRel}`;
        } else if (fs.existsSync(inRoot)) {
          // Arquivo está diretamente na raiz da company (formato legado)
          filePath = fileRel;
        } else {
          // Fallback: assumir subpasta (pode não existir, mas mantém compatibilidade)
          filePath = this.contactId ? `contact${this.contactId}/${fileRel}` : fileRel;
        }
      }

      // Construir URL baseada no ambiente
      const isDev = process.env.NODE_ENV !== 'production';
      
      if (isDev) {
        // Em desenvolvimento: sempre usar localhost:8080
        return `http://localhost:8080/public/company${this.companyId}/${filePath}`;
      } else {
        // Em produção: usar BACKEND_URL configurado
        const be = (process.env.BACKEND_URL || '').trim();
        const proxyPort = (process.env.PROXY_PORT || '').trim();
        const origin = be
          ? `${be}${proxyPort ? `:${proxyPort}` : ''}`
          : '';
        
        if (origin) {
          return `${origin}/public/company${this.companyId}/${filePath}`;
        }
        // Fallback: caminho relativo (proxy nginx pode resolver)
        return `/public/company${this.companyId}/${filePath}`;
      }
    }
    return null;
  }

  @Column
  mediaType: string;

  // Campo virtual: retorna tamanho do arquivo em bytes lendo do disco
  get mediaFileSize(): number | null {
    const fileRel = this.getDataValue("mediaUrl");
    if (!fileRel || /^https?:\/\//i.test(fileRel)) return null;
    try {
      const fs = require('fs');
      const pathModule = require('path');
      const companyDir = pathModule.resolve(__dirname, '..', '..', 'public', `company${this.companyId}`);
      // Tentar subpasta contact primeiro, depois raiz
      const candidates = [
        pathModule.join(companyDir, fileRel),
        fileRel.includes('/') ? pathModule.join(companyDir, fileRel.split('/').pop()) : null,
      ].filter(Boolean);
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          return fs.statSync(p).size;
        }
      }
    } catch { }
    return null;
  }

  @Default(false)
  @Column
  isDeleted: boolean;

  @Column(DataType.DATE(6))
  createdAt: Date;

  @UpdatedAt
  @Column(DataType.DATE(6))
  updatedAt: Date;

  @ForeignKey(() => Message)
  @Column
  quotedMsgId: string;

  @BelongsTo(() => Message, "quotedMsgId")
  quotedMsg: Message;

  @ForeignKey(() => Ticket)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @ForeignKey(() => TicketTraking)
  @Column
  ticketTrakingId: number;

  @BelongsTo(() => TicketTraking, "ticketTrakingId")
  ticketTraking: TicketTraking;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact, "contactId")
  contact: Contact;

  @ForeignKey(() => Company)
  @Column
  companyId: number;

  @BelongsTo(() => Company)
  company: Company;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @Column
  wid: string;

  @Default(false)
  @Column
  isPrivate: boolean;

  @Default(false)
  @Column
  isEdited: boolean;

  @Default(false)
  @Column
  isForwarded: boolean;

  @Default(false)
  @Column
  isStarred: boolean; // Mensagem fixada/destacada

  @Column(DataType.STRING)
  senderName: string; // Nome do remetente em mensagens de grupo
}

export default Message;