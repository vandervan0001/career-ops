// prospection-tsv.mjs -- Utilitaires de lecture/écriture prospection.tsv
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getClassification } from './prospection-core.mjs';

export const PROSPECTION_COLUMNS = [
  'date', 'company', 'contact', 'email', 'linkedin', 'sector',
  'signal', 'score', 'message_sent', 'status', 'notes', 'target_type', 'geo_priority', 'date_envoi',
];

export function parseTsvRow(headerCols, dataLine) {
  const vals = dataLine.split('\t');
  const row = {};
  headerCols.forEach((k, i) => { row[k.trim()] = (vals[i] || '').trim(); });
  return row;
}

export function serializeTsvRow(row) {
  return PROSPECTION_COLUMNS.map((col) => String(row[col] ?? '')).join('\t');
}

export function loadProspectionTsv(filePath) {
  if (!existsSync(filePath)) return { headerCols: PROSPECTION_COLUMNS, rows: [] };
  const lines = readFileSync(filePath, 'utf-8').split('\n').filter((l) => l.trim());
  const headerLine = lines.find((l) => l.startsWith('date\t'));
  const headerCols = headerLine ? headerLine.split('\t').map((c) => c.trim()) : PROSPECTION_COLUMNS;
  const rows = lines
    .filter((l) => !l.startsWith('date\t') && !l.startsWith('#'))
    .map((l) => {
      const row = parseTsvRow(headerCols, l);
      row.classification = getClassification(row.notes || '');
      return row;
    });
  return { headerCols, rows };
}

export function saveProspectionTsv(filePath, rows) {
  const header = PROSPECTION_COLUMNS.join('\t');
  const body = rows.map(serializeTsvRow).join('\n');
  writeFileSync(filePath, `${header}\n${body}\n`);
}
