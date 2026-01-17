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
    for (const record of records) {
      const sourceNumber = record['Source'] || record['SourceNumber'] || record['source_number'] || record['From'] || '';
      const destNumber = record['Destination'] || record['ToNumber'] || record['destination'] || record['To'] || '';

      // Parse countries from phone numbers
      const originCountry = getCountryFromPhoneNumber(sourceNumber);
      const destCountry = getCountryFromPhoneNumber(destNumber);

      await prisma.callRecord.create({
        data: {
          userName: record['User'] || record['UserName'] || record['user_name'] || '',
          userEmail: record['Email'] || record['UserEmail'] || record['user_email'] || '',
          callDate: new Date(record['Date'] || record['CallDate'] || record['call_date'] || new Date()),
          duration: parseInt(record['Duration'] || record['CallDuration'] || record['duration'] || '0'),
          callType: record['Type'] || record['CallType'] || record['call_type'] || 'Outbound',
          sourceNumber: sourceNumber,
          destination: destNumber,
          originCountry: originCountry,
          destCountry: destCountry,
          uploadedAt: new Date(),
        },
      });
      processed++;
    }

    // Record upload history
    await prisma.uploadHistory.create({
      data: {
        fileName: req.file.originalname,
        fileType: 'teams',
        recordCount: processed,
        uploadedBy: req.user?.email || 'unknown',
      },
    });

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ message: 'File processed successfully', recordsProcessed: processed });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file' });
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
    const headers = data[headerRowIndex].map((h: any) => String(h || '').toLowerCase());
    const originCol = headers.findIndex((h: string) => h.includes('originating'));
    const destCol = headers.findIndex((h: string) => h === 'destination' || h.includes('destination'));
    const callTypeCol = headers.findIndex((h: string) => h.includes('call type'));
    const priceCol = headers.findIndex((h: string) => h === 'price' || h.includes('price'));
    const effectiveDateCol = headers.findIndex((h: string) => h.includes('effective'));
    const endDateCol = headers.findIndex((h: string) => h.includes('end date'));

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

export default router;
