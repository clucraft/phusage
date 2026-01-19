import { Router, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';
import { getCountryFromPhoneNumber } from '../utils/countryCodes.js';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({ dest: 'uploads/' });

// Upload Teams call report
router.post('/teams-report', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filePath = req.file.path;
    const ext = req.file.originalname.split('.').pop()?.toLowerCase();
    let records: any[] = [];

    if (ext === 'csv') {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      records = await new Promise((resolve, reject) => {
        parse(fileContent, { columns: true, skip_empty_lines: true }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      records = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    }

    // Process and store call records
    let processed = 0;
    let skipped = 0;
    let dateRangeStart: Date | null = null;
    let dateRangeEnd: Date | null = null;

    for (const record of records) {
      // Only process Outbound calls
      const callDirection = (record['Call Direction'] || record['CallDirection'] || '').toLowerCase();
      if (callDirection && callDirection !== 'outbound') {
        skipped++;
        continue;
      }

      // Skip failed calls
      const success = record['Success'] || record['success'] || '';
      if (success.toLowerCase() === 'no' || success === '0' || success === 'false') {
        skipped++;
        continue;
      }

      // Get duration and skip zero-duration calls
      const duration = parseInt(
        record['Duration (seconds)'] || record['Duration'] || record['CallDuration'] || record['duration'] || '0'
      );
      if (duration === 0) {
        skipped++;
        continue;
      }

      // Get phone numbers
      const sourceNumber = record['Caller Number'] || record['Source'] || record['SourceNumber'] || record['From'] || '';
      const destNumber = record['Callee Number'] || record['Destination'] || record['ToNumber'] || record['To'] || '';

      // Parse countries from phone number country codes (matches Verizon rate naming)
      const originCountry = getCountryFromPhoneNumber(sourceNumber);
      const destCountry = getCountryFromPhoneNumber(destNumber);

      // Parse call date
      const callDate = new Date(record['Start time'] || record['Date'] || record['CallDate'] || record['call_date'] || new Date());

      // Track date range
      if (!dateRangeStart || callDate < dateRangeStart) {
        dateRangeStart = callDate;
      }
      if (!dateRangeEnd || callDate > dateRangeEnd) {
        dateRangeEnd = callDate;
      }

      await prisma.callRecord.create({
        data: {
          userName: record['Display Name'] || record['User'] || record['UserName'] || record['user_name'] || '',
          userEmail: record['UPN'] || record['Email'] || record['UserEmail'] || record['user_email'] || '',
          callDate,
          duration,
          callType: 'Outbound',
          sourceNumber,
          destination: destNumber,
          originCountry,
          destCountry,
          uploadedAt: new Date(),
        },
      });
      processed++;
    }

    // Record upload history with date range
    await prisma.uploadHistory.create({
      data: {
        fileName: req.file.originalname,
        fileType: 'teams',
        recordCount: processed,
        uploadedBy: req.user?.email || 'unknown',
        dateRangeStart,
        dateRangeEnd,
      },
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'File processed successfully',
      recordsProcessed: processed,
      recordsSkipped: skipped,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

// Clear all call records
router.delete('/call-records', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.callRecord.deleteMany({});
    res.json({ message: `Deleted ${result.count} call records` });
  } catch (error) {
    console.error('Clear call records error:', error);
    res.status(500).json({ error: 'Failed to clear call records' });
  }
});

// Upload Verizon rate matrix
router.post('/verizon-rates', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filePath = req.file.path;
    const ext = req.file.originalname.split('.').pop()?.toLowerCase();

    if (ext !== 'xlsx' && ext !== 'xls') {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: 'Only Excel files (.xlsx, .xls) are supported for rate uploads' });
      return;
    }

    const workbook = XLSX.readFile(filePath);

    // Look for the rate sheet
    const sheetName = workbook.SheetNames.find(name =>
      name.toLowerCase().includes('usage') && name.toLowerCase().includes('geographic')
    ) || 'Usage Geographic Termination';

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: `Sheet "${sheetName}" not found in file` });
      return;
    }

    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Find header row (look for "Originating Country" or "PRICE")
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (row && row.some((cell: any) => cell && String(cell).toLowerCase().includes('originating'))) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: 'Could not find header row in rate sheet' });
      return;
    }

    // Parse header to find column indices
    const rawHeaders = data[headerRowIndex] || [];
    const headers: string[] = [];
    for (let i = 0; i < rawHeaders.length; i++) {
      const h = rawHeaders[i];
      headers[i] = h != null ? String(h).toLowerCase().trim() : '';
    }

    const originCol = headers.findIndex((h) => h && h.includes('originating'));
    const destCol = headers.findIndex((h) => h && (h === 'destination' || h.includes('destination')));
    const callTypeCol = headers.findIndex((h) => h && h.includes('call type'));
    const priceCol = headers.findIndex((h) => h && (h === 'price' || h.includes('price')));
    const effectiveDateCol = headers.findIndex((h) => h && h.includes('effective'));
    const endDateCol = headers.findIndex((h) => h && h.includes('end date'));

    if (originCol === -1 || destCol === -1 || priceCol === -1) {
      fs.unlinkSync(filePath);
      res.status(400).json({ error: 'Required columns not found: Originating Country, Destination, Price' });
      return;
    }

    // Clear existing rates (optional - could make this configurable)
    const clearExisting = req.body.clearExisting !== 'false';
    if (clearExisting) {
      await prisma.rateMatrix.deleteMany({});
    }

    // Process rate rows
    let processed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !row[originCol] || !row[destCol]) continue;

      const originCountry = String(row[originCol]).trim();
      const destination = String(row[destCol]).trim();
      const callType = callTypeCol !== -1 ? String(row[callTypeCol] || 'Outbound').trim() : 'Outbound';
      const price = parseFloat(String(row[priceCol] || '0'));

      if (isNaN(price) || price < 0) {
        skipped++;
        continue;
      }

      // Extract base country from destination (e.g., "Afghanistan-Mobile" -> "Afghanistan")
      const destCountry = destination.split('-')[0].trim();

      // Parse dates if present
      let effectiveDate: Date | null = null;
      let endDate: Date | null = null;

      if (effectiveDateCol !== -1 && row[effectiveDateCol]) {
        try {
          effectiveDate = new Date(row[effectiveDateCol]);
          if (isNaN(effectiveDate.getTime())) effectiveDate = null;
        } catch (e) {
          effectiveDate = null;
        }
      }

      if (endDateCol !== -1 && row[endDateCol]) {
        try {
          endDate = new Date(row[endDateCol]);
          if (isNaN(endDate.getTime())) endDate = null;
        } catch (e) {
          endDate = null;
        }
      }

      try {
        await prisma.rateMatrix.upsert({
          where: {
            originCountry_destination_callType: {
              originCountry,
              destination,
              callType,
            },
          },
          update: {
            pricePerMinute: price,
            destCountry,
            effectiveDate,
            endDate,
          },
          create: {
            originCountry,
            destination,
            destCountry,
            callType,
            pricePerMinute: price,
            effectiveDate,
            endDate,
          },
        });
        processed++;
      } catch (error: any) {
        if (errors.length < 5) {
          errors.push(`Row ${i + 1}: ${error.message}`);
        }
        skipped++;
      }
    }

    // Record upload history
    await prisma.uploadHistory.create({
      data: {
        fileName: req.file.originalname,
        fileType: 'rates',
        recordCount: processed,
        uploadedBy: req.user?.email || 'unknown',
      },
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'Rate file processed successfully',
      recordsProcessed: processed,
      recordsSkipped: skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Rate upload error:', error);
    res.status(500).json({ error: 'Failed to process rate file' });
  }
});

// Get upload history
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const { fileType } = req.query;

    const where = fileType ? { fileType: fileType as string } : {};

    const history = await prisma.uploadHistory.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    // Calculate gaps for teams uploads
    const teamsUploads = history
      .filter(h => h.fileType === 'teams' && h.dateRangeStart && h.dateRangeEnd)
      .sort((a, b) => new Date(a.dateRangeStart!).getTime() - new Date(b.dateRangeStart!).getTime());

    const gaps: Array<{ start: Date; end: Date }> = [];

    for (let i = 0; i < teamsUploads.length - 1; i++) {
      const currentEnd = new Date(teamsUploads[i].dateRangeEnd!);
      const nextStart = new Date(teamsUploads[i + 1].dateRangeStart!);

      // Check if there's a gap of more than 1 day
      const diffDays = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > 1) {
        const gapStart = new Date(currentEnd);
        gapStart.setDate(gapStart.getDate() + 1);
        const gapEnd = new Date(nextStart);
        gapEnd.setDate(gapEnd.getDate() - 1);
        gaps.push({ start: gapStart, end: gapEnd });
      }
    }

    res.json({ history, gaps });
  } catch (error) {
    console.error('Upload history error:', error);
    res.status(500).json({ error: 'Failed to fetch upload history' });
  }
});

// Delete upload history entry (doesn't delete the actual call records)
router.delete('/history/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string);

    await prisma.uploadHistory.delete({
      where: { id },
    });

    res.json({ message: 'Upload history entry deleted' });
  } catch (error) {
    console.error('Delete upload history error:', error);
    res.status(500).json({ error: 'Failed to delete upload history entry' });
  }
});

export default router;
