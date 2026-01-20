import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Helper function to generate share token
function generateShareToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Get available templates (origin countries with call data)
router.get('/templates', async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    const selectedYear = year ? Number(year) : new Date().getFullYear();

    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31, 23, 59, 59);

    // Get all calls grouped by origin country for the selected year
    const callsByOrigin = await prisma.callRecord.groupBy({
      by: ['originCountry'],
      where: {
        callDate: {
          gte: startDate,
          lte: endDate,
        },
        originCountry: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    // Get unique users per origin country
    const templates = await Promise.all(
      callsByOrigin.map(async (item) => {
        if (!item.originCountry) return null;

        const uniqueUsers = await prisma.callRecord.findMany({
          where: {
            originCountry: item.originCountry,
            callDate: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            userEmail: true,
          },
          distinct: ['userEmail'],
        });

        return {
          country: item.originCountry,
          userCount: uniqueUsers.length,
          callCount: item._count.id,
          year: selectedYear,
        };
      })
    );

    // Filter out nulls and sort by call count
    const validTemplates = templates
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .sort((a, b) => b.callCount - a.callCount);

    res.json(validTemplates);
  } catch (error) {
    console.error('Templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get available years that have call data
router.get('/years', async (req: AuthRequest, res: Response) => {
  try {
    const calls = await prisma.callRecord.findMany({
      select: {
        callDate: true,
      },
      distinct: ['callDate'],
    });

    const years = [...new Set(calls.map(c => c.callDate.getFullYear()))].sort((a, b) => b - a);

    res.json(years);
  } catch (error) {
    console.error('Years error:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

// Get template data for a specific origin country
router.get('/template/:country', async (req: AuthRequest, res: Response) => {
  try {
    const country = req.params.country as string;
    const { year } = req.query;
    const selectedYear = year ? Number(year) : new Date().getFullYear();

    const startDate = new Date(selectedYear, 0, 1);
    const endDate = new Date(selectedYear, 11, 31, 23, 59, 59);

    // Get all calls from this origin country
    const calls = await prisma.callRecord.findMany({
      where: {
        originCountry: country,
        callDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        userEmail: true,
        destCountry: true,
        duration: true,
        callDate: true,
      },
    });

    if (calls.length === 0) {
      res.status(404).json({ error: 'No call data found for this template' });
      return;
    }

    // Calculate unique users
    const uniqueUsers = new Set(calls.map(c => c.userEmail));
    const userCount = uniqueUsers.size;

    // Calculate destination distribution
    const destCounts: Record<string, { calls: number; totalDuration: number }> = {};
    let totalCalls = 0;
    let totalDuration = 0;

    for (const call of calls) {
      const dest = call.destCountry || 'Unknown';
      if (!destCounts[dest]) {
        destCounts[dest] = { calls: 0, totalDuration: 0 };
      }
      destCounts[dest].calls += 1;
      destCounts[dest].totalDuration += call.duration;
      totalCalls += 1;
      totalDuration += call.duration;
    }

    // Convert to array with percentages
    const destinations = Object.entries(destCounts)
      .map(([country, data]) => ({
        country,
        calls: data.calls,
        percentage: Math.round((data.calls / totalCalls) * 100),
        avgMinutes: Math.round((data.totalDuration / data.calls / 60) * 10) / 10,
      }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10); // Top 10 destinations

    // Recalculate percentages to ensure they sum to 100
    const totalPercentage = destinations.reduce((sum, d) => sum + d.percentage, 0);
    if (totalPercentage !== 100 && destinations.length > 0) {
      // Adjust the largest one to make it sum to 100
      destinations[0].percentage += (100 - totalPercentage);
    }

    // Calculate averages
    const avgCallsPerUser = Math.round((totalCalls / userCount) * 10) / 10;
    const avgMinutesPerCall = Math.round((totalDuration / totalCalls / 60) * 10) / 10;

    // Calculate months in range with data
    const monthsWithData = new Set(calls.map(c => {
      const d = new Date(c.callDate);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })).size;

    const avgCallsPerUserPerMonth = Math.round((totalCalls / userCount / Math.max(monthsWithData, 1)) * 10) / 10;

    res.json({
      originCountry: country,
      year: selectedYear,
      userCount,
      totalCalls,
      avgCallsPerUserPerMonth,
      avgMinutesPerCall,
      destinations,
    });
  } catch (error) {
    console.error('Template data error:', error);
    res.status(500).json({ error: 'Failed to fetch template data' });
  }
});

// Calculate cost estimate
router.post('/calculate', async (req: AuthRequest, res: Response) => {
  try {
    const {
      originCountry,
      userCount,
      callsPerUserPerMonth,
      avgMinutesPerCall,
      destinations, // Array of { country, percentage }
      carrierId,    // Optional carrier filter
    } = req.body;

    // Validate inputs
    if (!originCountry || !userCount || !callsPerUserPerMonth || !avgMinutesPerCall || !destinations) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get rates for the origin country, optionally filtered by carrier
    const rateFilter: any = { originCountry: originCountry };
    if (carrierId) {
      rateFilter.carrierId = parseInt(carrierId);
    }
    const rates = await prisma.rateMatrix.findMany({
      where: rateFilter,
    });

    // Calculate total monthly calls and minutes
    const totalMonthlyCallsPerUser = callsPerUserPerMonth;
    const totalMonthlyCalls = userCount * totalMonthlyCallsPerUser;
    const totalMonthlyMinutes = totalMonthlyCalls * avgMinutesPerCall;

    // Calculate costs per destination
    const breakdown = [];
    let totalMonthlyCost = 0;

    for (const dest of destinations) {
      const destPercentage = dest.percentage / 100;
      const destCalls = Math.round(totalMonthlyCalls * destPercentage);
      const destMinutes = Math.round(totalMonthlyMinutes * destPercentage);

      // Find rate for this destination
      let rate = rates.find(r => r.destCountry === dest.country);
      if (!rate) {
        // Try to find by destination field
        rate = rates.find(r => r.destination === dest.country);
      }

      const pricePerMinute = rate ? Number(rate.pricePerMinute) : 0;
      const destCost = destMinutes * pricePerMinute;
      totalMonthlyCost += destCost;

      breakdown.push({
        country: dest.country,
        percentage: dest.percentage,
        calls: destCalls,
        minutes: destMinutes,
        ratePerMinute: pricePerMinute,
        monthlyCost: Math.round(destCost * 100) / 100,
        rateFound: !!rate,
      });
    }

    // Sort breakdown by cost
    breakdown.sort((a, b) => b.monthlyCost - a.monthlyCost);

    res.json({
      summary: {
        originCountry,
        userCount,
        callsPerUserPerMonth,
        avgMinutesPerCall,
        totalMonthlyCalls,
        totalMonthlyMinutes: Math.round(totalMonthlyMinutes),
        monthlyCost: Math.round(totalMonthlyCost * 100) / 100,
        yearlyCost: Math.round(totalMonthlyCost * 12 * 100) / 100,
        costPerUser: Math.round((totalMonthlyCost / userCount) * 100) / 100,
        carrierId: carrierId ? parseInt(carrierId) : null,
      },
      breakdown,
    });
  } catch (error) {
    console.error('Calculate error:', error);
    res.status(500).json({ error: 'Failed to calculate estimate' });
  }
});

// Get all destination countries (for dropdown)
router.get('/destinations', async (req: AuthRequest, res: Response) => {
  try {
    // Get unique destination countries from call records
    const destFromCalls = await prisma.callRecord.findMany({
      select: {
        destCountry: true,
      },
      distinct: ['destCountry'],
    });

    // Get unique destination countries from rate matrix
    const destFromRates = await prisma.rateMatrix.findMany({
      select: {
        destCountry: true,
      },
      distinct: ['destCountry'],
    });

    // Combine and deduplicate
    const allDests = new Set<string>();
    for (const d of destFromCalls) {
      if (d.destCountry) allDests.add(d.destCountry);
    }
    for (const d of destFromRates) {
      if (d.destCountry) allDests.add(d.destCountry);
    }

    const destinations = [...allDests].sort();

    res.json(destinations);
  } catch (error) {
    console.error('Destinations error:', error);
    res.status(500).json({ error: 'Failed to fetch destinations' });
  }
});

// Get all origin countries (for new site country dropdown)
router.get('/origins', async (req: AuthRequest, res: Response) => {
  try {
    // Get unique origin countries from rate matrix (these are countries we have rates for)
    const origins = await prisma.rateMatrix.findMany({
      select: {
        originCountry: true,
      },
      distinct: ['originCountry'],
    });

    const countries = [...new Set(origins.map(o => o.originCountry))].sort();

    res.json(countries);
  } catch (error) {
    console.error('Origins error:', error);
    res.status(500).json({ error: 'Failed to fetch origins' });
  }
});

// ============================================
// SAVED ESTIMATE ENDPOINTS
// ============================================

// List user's saved estimates
router.get('/saved', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const estimates = await prisma.savedEstimate.findMany({
      where: { userId },
      include: {
        carrier: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(estimates);
  } catch (error) {
    console.error('List saved estimates error:', error);
    res.status(500).json({ error: 'Failed to fetch saved estimates' });
  }
});

// Save new estimate
router.post('/saved', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      name,
      originCountry,
      userCount,
      callsPerUserPerMonth,
      avgMinutesPerCall,
      destinations,
      carrierId,
      results,
      notes,
    } = req.body;

    if (!name || !originCountry || !userCount || !destinations || !results) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const estimate = await prisma.savedEstimate.create({
      data: {
        name,
        originCountry,
        userCount,
        callsPerUserPerMonth,
        avgMinutesPerCall,
        destinations,
        carrierId: carrierId ? parseInt(carrierId) : null,
        results,
        notes: notes || null,
        userId,
      },
      include: {
        carrier: {
          select: { name: true },
        },
      },
    });

    res.status(201).json(estimate);
  } catch (error) {
    console.error('Save estimate error:', error);
    res.status(500).json({ error: 'Failed to save estimate' });
  }
});

// Load specific estimate
router.get('/saved/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);

    const estimate = await prisma.savedEstimate.findFirst({
      where: { id, userId },
      include: {
        carrier: {
          select: { name: true },
        },
      },
    });

    if (!estimate) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    res.json(estimate);
  } catch (error) {
    console.error('Load estimate error:', error);
    res.status(500).json({ error: 'Failed to load estimate' });
  }
});

// Update estimate
router.patch('/saved/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);
    const {
      name,
      originCountry,
      userCount,
      callsPerUserPerMonth,
      avgMinutesPerCall,
      destinations,
      carrierId,
      results,
      notes,
    } = req.body;

    // Check ownership
    const existing = await prisma.savedEstimate.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    const estimate = await prisma.savedEstimate.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        originCountry: originCountry !== undefined ? originCountry : existing.originCountry,
        userCount: userCount !== undefined ? userCount : existing.userCount,
        callsPerUserPerMonth: callsPerUserPerMonth !== undefined ? callsPerUserPerMonth : existing.callsPerUserPerMonth,
        avgMinutesPerCall: avgMinutesPerCall !== undefined ? avgMinutesPerCall : existing.avgMinutesPerCall,
        destinations: destinations !== undefined ? destinations : existing.destinations,
        carrierId: carrierId !== undefined ? (carrierId ? parseInt(carrierId) : null) : existing.carrierId,
        results: results !== undefined ? results : existing.results,
        notes: notes !== undefined ? notes : existing.notes,
      },
      include: {
        carrier: {
          select: { name: true },
        },
      },
    });

    res.json(estimate);
  } catch (error) {
    console.error('Update estimate error:', error);
    res.status(500).json({ error: 'Failed to update estimate' });
  }
});

// Delete estimate
router.delete('/saved/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);

    // Check ownership
    const existing = await prisma.savedEstimate.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    await prisma.savedEstimate.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete estimate error:', error);
    res.status(500).json({ error: 'Failed to delete estimate' });
  }
});

// ============================================
// SHARE ENDPOINTS
// ============================================

// Generate share token
router.post('/saved/:id/share', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);

    // Check ownership
    const existing = await prisma.savedEstimate.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    // Generate token if not exists
    const shareToken = existing.shareToken || generateShareToken();

    const estimate = await prisma.savedEstimate.update({
      where: { id },
      data: {
        shareToken,
        isPublic: true,
      },
    });

    res.json({ shareToken: estimate.shareToken });
  } catch (error) {
    console.error('Create share link error:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// Remove share link
router.delete('/saved/:id/share', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id);

    // Check ownership
    const existing = await prisma.savedEstimate.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Estimate not found' });
      return;
    }

    await prisma.savedEstimate.update({
      where: { id },
      data: {
        shareToken: null,
        isPublic: false,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Remove share link error:', error);
    res.status(500).json({ error: 'Failed to remove share link' });
  }
});

// ============================================
// PDF EXPORT ENDPOINT
// ============================================

router.post('/pdf', async (req: AuthRequest, res: Response) => {
  try {
    const {
      originCountry,
      userCount,
      callsPerUserPerMonth,
      avgMinutesPerCall,
      destinations,
      carrierId,
      results,
      carrierName,
    } = req.body;

    if (!results) {
      res.status(400).json({ error: 'Results are required for PDF generation' });
      return;
    }

    const doc = new PDFDocument({ margin: 50 });
    const filename = `cost-estimate-${originCountry?.replace(/\s+/g, '-') || 'report'}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Title
    doc.fontSize(24).text('Cost Estimate Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    // Parameters Section
    doc.fontSize(16).text('Estimate Parameters', { underline: true });
    doc.moveDown();
    doc.fontSize(11);
    doc.text(`Origin Country: ${originCountry || 'N/A'}`);
    doc.text(`Expected Users: ${userCount || 'N/A'}`);
    doc.text(`Calls per User per Month: ${callsPerUserPerMonth || 'N/A'}`);
    doc.text(`Average Minutes per Call: ${avgMinutesPerCall || 'N/A'}`);
    if (carrierName) {
      doc.text(`Carrier: ${carrierName}`);
    }
    doc.moveDown(2);

    // Cost Projections Section
    doc.fontSize(16).text('Cost Projections', { underline: true });
    doc.moveDown();
    doc.fontSize(12);

    const summary = results.summary;
    doc.font('Helvetica-Bold').text(`Monthly Cost: $${summary.monthlyCost?.toFixed(2) || '0.00'}`);
    doc.text(`Yearly Cost: $${summary.yearlyCost?.toFixed(2) || '0.00'}`);
    doc.text(`Cost per User/Month: $${summary.costPerUser?.toFixed(2) || '0.00'}`);
    doc.font('Helvetica');
    doc.moveDown();
    doc.text(`Total Monthly Calls: ${summary.totalMonthlyCalls?.toLocaleString() || '0'}`);
    doc.text(`Total Monthly Minutes: ${summary.totalMonthlyMinutes?.toLocaleString() || '0'}`);
    doc.moveDown(2);

    // Cost Breakdown Section
    doc.fontSize(16).text('Cost Breakdown by Destination', { underline: true });
    doc.moveDown();

    // Table header
    doc.fontSize(9).font('Helvetica-Bold');
    const tableTop = doc.y;
    doc.text('Destination', 50, tableTop, { width: 120 });
    doc.text('%', 170, tableTop, { width: 30, align: 'right' });
    doc.text('Minutes', 200, tableTop, { width: 60, align: 'right' });
    doc.text('Rate/Min', 260, tableTop, { width: 60, align: 'right' });
    doc.text('Monthly Cost', 320, tableTop, { width: 80, align: 'right' });
    doc.moveDown();

    // Draw header line
    doc.moveTo(50, doc.y).lineTo(400, doc.y).stroke();
    doc.moveDown(0.5);

    // Table rows
    doc.font('Helvetica').fontSize(9);
    const breakdown = results.breakdown || [];
    for (const item of breakdown) {
      if (doc.y > 700) {
        doc.addPage();
      }
      const rowY = doc.y;
      doc.text(item.country?.substring(0, 20) || 'Unknown', 50, rowY, { width: 120 });
      doc.text(`${item.percentage || 0}%`, 170, rowY, { width: 30, align: 'right' });
      doc.text((item.minutes || 0).toLocaleString(), 200, rowY, { width: 60, align: 'right' });
      doc.text(item.ratePerMinute > 0 ? `$${item.ratePerMinute.toFixed(4)}` : '-', 260, rowY, { width: 60, align: 'right' });
      doc.text(`$${(item.monthlyCost || 0).toFixed(2)}`, 320, rowY, { width: 80, align: 'right' });
      doc.moveDown(0.7);
    }

    // Total row
    doc.moveTo(50, doc.y).lineTo(400, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold');
    const totalY = doc.y;
    doc.text('Total', 50, totalY, { width: 270 });
    doc.text(`$${summary.monthlyCost?.toFixed(2) || '0.00'}`, 320, totalY, { width: 80, align: 'right' });
    doc.moveDown(2);

    // Warnings Section
    const missingRates = breakdown.filter((b: any) => !b.rateFound);
    if (missingRates.length > 0) {
      doc.font('Helvetica').fontSize(11);
      doc.fillColor('orange').text('Warnings:', { underline: true });
      doc.fillColor('black');
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`The following destinations do not have rates configured for ${originCountry}:`);
      doc.moveDown(0.3);
      for (const item of missingRates) {
        doc.text(`  • ${item.country}`, { indent: 10 });
      }
      doc.moveDown();
      doc.text('These destinations are shown with $0 cost. Upload rates for more accurate estimates.');
    }

    doc.end();
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
