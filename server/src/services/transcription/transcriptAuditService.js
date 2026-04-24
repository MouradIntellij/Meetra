import fs from 'node:fs';
import path from 'node:path';
import { ENV } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const auditFile = path.resolve(process.cwd(), ENV.TRANSCRIPT_AUDIT_FILE);

function ensureAuditDir() {
    const dir = path.dirname(auditFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

export function appendTranscriptAudit(entry) {
    try {
        ensureAuditDir();
        fs.appendFileSync(
            auditFile,
            `${JSON.stringify({ ...entry, ts: new Date().toISOString() })}\n`,
            'utf8'
        );
    } catch (error) {
        logger.warn('Transcript audit append failed:', error?.message);
    }
}
