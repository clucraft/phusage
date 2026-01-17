import { Router, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';
import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.js';
import fs from 'fs';

const router = Router();
const prisma = new PrismaClient();

const upload = multer({ dest: 'uploads/' });

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
      await prisma.callRecord.create({
        data: {
          userName: record['User'] || record['UserName'] || record['user_name'] || '',
          userEmail: record['Email'] || record['UserEmail'] || record['user_email'] || '',
          callDate: new Date(record['Date'] || record['CallDate'] || record['call_date'] || new Date()),
          duration: parseInt(record['Duration'] || record['CallDuration'] || record['duration'] || '0'),
          callType: record['Type'] || record['CallType'] || record['call_type'] || 'audio',
          destination: record['Destination'] || record['ToNumber'] || record['destination'] || '',
          uploadedAt: new Date(),
        },
      });
      processed++;
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({ message: 'File processed successfully', recordsProcessed: processed });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process file' });
  }
});

export default router;
