import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Export usage summary as CSV
router.get('/csv', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;

    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const usageSummary = await prisma.callRecord.groupBy({
      by: ['userEmail', 'userName'],
      where: dateFilter,
      _sum: {
        duration: true,
      },
      _count: {
        id: true,
      },
    });

    const rates = await prisma.rateMatrix.findMany();
    const rateMap = new Map(rates.map(r => [r.callType, r.ratePerMinute]));

    const summaryWithCosts = await Promise.all(
      usageSummary.map(async (user) => {
        const userCalls = await prisma.callRecord.findMany({
          where: {
            userEmail: user.userEmail,
            ...dateFilter,
          },
          select: {
            callType: true,
            duration: true,
          },
        });

        const totalCost = userCalls.reduce((sum, call) => {
          const rate = rateMap.get(call.callType) || rateMap.get('default') || 0;
          return sum + (call.duration / 60) * Number(rate);
        }, 0);

        return {
          userName: user.userName,
          userEmail: user.userEmail,
          totalMinutes: Math.round((user._sum.duration || 0) / 60),
          totalCalls: user._count.id,
          totalCost: Math.round(totalCost * 100) / 100,
        };
      })
    );

    // Generate CSV
    const csvHeader = 'User Name,Email,Total Minutes,Total Calls,Total Cost\n';
    const csvRows = summaryWithCosts
      .sort((a, b) => b.totalCost - a.totalCost)
      .map(u => `"${u.userName}","${u.userEmail}",${u.totalMinutes},${u.totalCalls},${u.totalCost}`)
      .join('\n');

    const filename = month && year ? `usage-report-${year}-${month}.csv` : 'usage-report.csv';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvHeader + csvRows);
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});

// Export usage summary as PDF
router.get('/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query;

    let dateFilter = {};
    let reportTitle = 'Usage Report - All Time';
    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      dateFilter = {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      };
      const monthName = startDate.toLocaleString('default', { month: 'long' });
      reportTitle = `Usage Report - ${monthName} ${year}`;
    }

    const usageSummary = await prisma.callRecord.groupBy({
      by: ['userEmail', 'userName'],
      where: dateFilter,
      _sum: {
        duration: true,
      },
      _count: {
        id: true,
      },
    });

    const rates = await prisma.rateMatrix.findMany();
    const rateMap = new Map(rates.map(r => [r.callType, r.ratePerMinute]));

    const summaryWithCosts = await Promise.all(
      usageSummary.map(async (user) => {
        const userCalls = await prisma.callRecord.findMany({
          where: {
            userEmail: user.userEmail,
            ...dateFilter,
          },
          select: {
            callType: true,
            duration: true,
          },
        });

        const totalCost = userCalls.reduce((sum, call) => {
          const rate = rateMap.get(call.callType) || rateMap.get('default') || 0;
          return sum + (call.duration / 60) * Number(rate);
        }, 0);

        return {
          userName: user.userName,
          userEmail: user.userEmail,
          totalMinutes: Math.round((user._sum.duration || 0) / 60),
          totalCalls: user._count.id,
          totalCost: Math.round(totalCost * 100) / 100,
        };
      })
    );

    const sortedData = summaryWithCosts.sort((a, b) => b.totalCost - a.totalCost);

    // Generate PDF
    const doc = new PDFDocument({ margin: 50 });
    const filename = month && year ? `usage-report-${year}-${month}.pdf` : 'usage-report.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title
    doc.fontSize(20).text(reportTitle, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    const totalCost = sortedData.reduce((sum, u) => sum + u.totalCost, 0);
    const totalMinutes = sortedData.reduce((sum, u) => sum + u.totalMinutes, 0);
    doc.fontSize(12).text(`Total Users: ${sortedData.length}`);
    doc.text(`Total Minutes: ${totalMinutes.toLocaleString()}`);
    doc.text(`Total Cost: $${totalCost.toFixed(2)}`);
    doc.moveDown(2);

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('User Name', 50, doc.y, { continued: true, width: 150 });
    doc.text('Minutes', 200, doc.y, { continued: true, width: 70, align: 'right' });
    doc.text('Calls', 280, doc.y, { continued: true, width: 50, align: 'right' });
    doc.text('Cost', 340, doc.y, { width: 70, align: 'right' });
    doc.moveDown();

    // Table rows
    doc.font('Helvetica');
    for (const user of sortedData) {
      if (doc.y > 700) {
        doc.addPage();
      }
      doc.text(user.userName.substring(0, 25), 50, doc.y, { continued: true, width: 150 });
      doc.text(user.totalMinutes.toString(), 200, doc.y, { continued: true, width: 70, align: 'right' });
      doc.text(user.totalCalls.toString(), 280, doc.y, { continued: true, width: 50, align: 'right' });
      doc.text(`$${user.totalCost.toFixed(2)}`, 340, doc.y, { width: 70, align: 'right' });
      doc.moveDown(0.5);
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to export PDF' });
  }
});

export default router;
