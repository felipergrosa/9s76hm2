export interface ImportContactLog {
    sequenceNumber: number;
    originalJid: string;
    extractedNumber: string;
    normalizedNumber: string;
    canonicalNumber: string | null;
    whatsappName: string;
    status: 'CREATED' | 'ALREADY_EXISTS' | 'UPDATED' | 'FAILED' | 'SKIPPED';
    action: string;
    contactIdInDb: number | null;
    nameInDb: string | null;
    searchMethod: 'canonicalNumber' | 'number' | 'both' | 'not_found' | 'special_jid';
    matchCriteria: string | null;
    tagsApplied: string[];
    errorMessage: string | null;
    errorStack: string | null;
    timestamp: Date;
}

export interface ImportContactReport {
    importId: string;
    totalContacts: number;
    created: number;
    alreadyExists: number;
    updated: number;
    failed: number;
    skipped: number;
    logs: ImportContactLog[];
    generatedAt: Date;
}
