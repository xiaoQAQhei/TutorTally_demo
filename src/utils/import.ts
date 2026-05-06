import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { addStudent, addSubject, addLesson, addPayment, addRecurringRule } from '../database';
import { LessonStatus } from '../models';

function parseCsvSection(text: string): Record<string, any>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const row: Record<string, any> = {};
    let current = ''; let inQuotes = false; let colIdx = 0;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row[headers[colIdx] || `col${colIdx}`] = current; current = ''; colIdx++; }
        else current += ch;
      }
    }
    if (colIdx < headers.length) row[headers[colIdx] || `col${colIdx}`] = current;
    return row;
  });
}

function parseSections(text: string): Record<string, Record<string, any>[]> {
  const sections: Record<string, Record<string, any>[]> = {};
  const parts = text.split(/^# /m).filter(Boolean);
  for (const part of parts) {
    const newlineIdx = part.indexOf('\n');
    const name = newlineIdx >= 0 ? part.substring(0, newlineIdx).trim() : part.trim();
    const body = newlineIdx >= 0 ? part.substring(newlineIdx + 1) : '';
    sections[name] = parseCsvSection(body);
  }
  return sections;
}

export async function pickAndImportCsv(): Promise<{ imported: number; errors: string[] }> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'text/*' });
  if (result.canceled) return { imported: 0, errors: [] };

  const file = result.assets[0];
  const content = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.UTF8 });
  const sections = parseSections(content);
  const errors: string[] = [];
  const idMap = new Map<string, number>();

  for (const row of sections.students || []) {
    try {
      const id = await addStudent({
        name: row.name, phone: row.phone || '', address: row.address || null,
        defaultLocation: row.defaultLocation || null, color: row.color || null,
        createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || undefined,
      });
      if (row._uuid) idMap.set(row._uuid, id);
    } catch (e: any) { errors.push(`Student ${row.name}: ${e.message}`); }
  }

  for (const row of sections.student_subjects || []) {
    try {
      const id = await addSubject({
        studentId: Number(idMap.get(row.studentId) || row.studentId),
        subject: row.subject, hourlyRate: Number(row.hourlyRate), color: row.color || null,
        createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || undefined,
      });
      if (row._uuid) idMap.set(row._uuid, id);
    } catch (e: any) { errors.push(`Subject: ${e.message}`); }
  }

  for (const row of sections.lessons || []) {
    try {
      const id = await addLesson({
        studentId: Number(idMap.get(row.studentId) || row.studentId),
        studentSubjectId: row.studentSubjectId ? Number(idMap.get(row.studentSubjectId) || row.studentSubjectId) : undefined,
        date: row.date, timeSlot: row.timeSlot || '', duration: Number(row.duration),
        amount: Number(row.amount), manualAmount: row.manualAmount ? Number(row.manualAmount) : undefined,
        status: (row.status as LessonStatus) || 'scheduled',
        confirmedAt: row.confirmedAt || null, notes: row.notes || '',
        createdAt: row.createdAt || new Date().toISOString(), updatedAt: row.updatedAt || undefined,
      });
      if (row._uuid) idMap.set(row._uuid, id);
    } catch (e: any) { errors.push(`Lesson: ${e.message}`); }
  }

  for (const row of sections.payments || []) {
    try {
      await addPayment({
        lessonId: Number(idMap.get(row.lessonId) || row.lessonId),
        amount: Number(row.amount), method: row.method || 'cash',
        paidAt: row.paidAt || new Date().toISOString(), notes: row.notes || null,
        createdAt: row.createdAt || new Date().toISOString(),
      });
    } catch (e: any) { errors.push(`Payment: ${e.message}`); }
  }

  for (const row of sections.recurring_rules || []) {
    try {
      await addRecurringRule({
        studentId: Number(idMap.get(row.studentId) || row.studentId),
        studentSubjectId: row.studentSubjectId ? Number(idMap.get(row.studentSubjectId) || row.studentSubjectId) : undefined,
        weekdays: row.weekdays || '[]', interval: Number(row.interval) || 1,
        timeSlot: row.timeSlot, duration: Number(row.duration),
        amount: row.amount ? Number(row.amount) : undefined,
        startDate: row.startDate, endDate: row.endDate || null,
        excludedDates: row.excludedDates || '[]', notes: row.notes || null,
        createdAt: row.createdAt || new Date().toISOString(),
      });
    } catch (e: any) { errors.push(`Rule: ${e.message}`); }
  }

  return { imported: idMap.size, errors };
}
