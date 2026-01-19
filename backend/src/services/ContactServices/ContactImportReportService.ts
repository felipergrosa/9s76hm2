import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { ImportContactLog, ImportContactReport } from '../../types/importTypes';
import logger from '../../utils/logger';

interface GenerateReportParams {
    logs: ImportContactLog[];
    companyId: number;
}

interface GenerateReportResult {
    reportId: string;
    filePath: string;
    fileName: string;
}

const ContactImportReportService = {
    /**
     * Gera arquivo CSV com relatório detalhado da importação
     */
    async generate({ logs, companyId }: GenerateReportParams): Promise<GenerateReportResult> {
        const reportId = uuidv4();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `import-report-${companyId}-${timestamp}.csv`;

        // Diretório temporário para relatórios (será limpo após 24h)
        const reportsDir = path.join(process.cwd(), 'public', 'temp', 'import-reports');
        await fs.mkdir(reportsDir, { recursive: true });

        const filePath = path.join(reportsDir, fileName);

        // Configurar CSV writer
        const csvWriter = createObjectCsvWriter({
            path: filePath,
            header: [
                { id: 'sequenceNumber', title: '#' },
                { id: 'originalJid', title: 'JID Original' },
                { id: 'extractedNumber', title: 'Número Extraído' },
                { id: 'normalizedNumber', title: 'Número Normalizado' },
                { id: 'canonicalNumber', title: 'Número Canônico' },
                { id: 'whatsappName', title: 'Nome WhatsApp' },
                { id: 'status', title: 'Status' },
                { id: 'action', title: 'Ação Realizada' },
                { id: 'contactIdInDb', title: 'ID no Banco' },
                { id: 'nameInDb', title: 'Nome no Banco' },
                { id: 'searchMethod', title: 'Método de Busca' },
                { id: 'matchCriteria', title: 'Critério Match' },
                { id: 'tagsApplied', title: 'Tags Aplicadas' },
                { id: 'errorMessage', title: 'Erro' },
                { id: 'timestamp', title: 'Timestamp' },
            ],
            encoding: 'utf8',
            alwaysQuote: true
        });

        // Preparar dados para CSV
        const csvRecords = logs.map(log => ({
            sequenceNumber: log.sequenceNumber,
            originalJid: log.originalJid,
            extractedNumber: log.extractedNumber,
            normalizedNumber: log.normalizedNumber,
            canonicalNumber: log.canonicalNumber || '',
            whatsappName: log.whatsappName,
            status: log.status,
            action: log.action,
            contactIdInDb: log.contactIdInDb || '',
            nameInDb: log.nameInDb || '',
            searchMethod: log.searchMethod,
            matchCriteria: log.matchCriteria || '',
            tagsApplied: log.tagsApplied.join(', '),
            errorMessage: log.errorMessage || '',
            timestamp: log.timestamp.toISOString()
        }));

        // Escrever CSV
        await csvWriter.writeRecords(csvRecords);

        logger.info(`[ContactImportReportService] Relatório gerado: ${fileName} (${logs.length} registros)`);

        return {
            reportId,
            filePath,
            fileName
        };
    },

    /**
     * Retorna URL pública para download do relatório
     */
    getDownloadUrl(fileName: string): string {
        const baseUrl = process.env.BACKEND_URL || 'http://localhost:8080';
        return `${baseUrl}/public/temp/import-reports/${fileName}`;
    },

    /**
     * Limpa relatórios antigos (mais de 24 horas)
     */
    async cleanup(): Promise<void> {
        try {
            const reportsDir = path.join(process.cwd(), 'public', 'temp', 'import-reports');
            const files = await fs.readdir(reportsDir);
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;

            for (const file of files) {
                const filePath = path.join(reportsDir, file);
                const stats = await fs.stat(filePath);
                const fileAge = now - stats.mtimeMs;

                if (fileAge > oneDayMs) {
                    await fs.unlink(filePath);
                    logger.info(`[ContactImportReportService] Relatório antigo removido: ${file}`);
                }
            }
        } catch (error) {
            logger.error('[ContactImportReportService] Erro ao limpar relatórios antigos:', error);
        }
    }
};

export default ContactImportReportService;
