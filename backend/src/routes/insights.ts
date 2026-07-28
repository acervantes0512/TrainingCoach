import { Router, Request, Response } from 'express';
import * as InsightsService from '../services/insights.service.js';

const router = Router();

router.get('/protein-streak', async (_req: Request, res: Response) => {
  res.json(await InsightsService.getProteinStreak());
});

router.get('/adherence', async (req: Request, res: Response) => {
  const { from, to } = req.query;
  if (!from || !to) {
    res.status(400).json({ error: 'from and to required' });
    return;
  }
  res.json(await InsightsService.getAdherenceCalendar(from as string, to as string));
});

router.get('/milestones', async (_req: Request, res: Response) => {
  res.json(await InsightsService.getMilestones());
});

router.get('/deficit-efficiency', async (_req: Request, res: Response) => {
  res.json(await InsightsService.getDeficitEfficiency());
});

router.get('/protein-distribution/:date', async (req: Request, res: Response) => {
  res.json(await InsightsService.getProteinDistribution(req.params.date));
});

router.get('/whtr', async (req: Request, res: Response) => {
  const height = req.query.height ? Number(req.query.height) : undefined;
  res.json(await InsightsService.getWaistToHeightRatio(height));
});

router.get('/training-today', async (_req: Request, res: Response) => {
  res.json(InsightsService.getTodayTraining());
});

router.get('/weekly-report/:weekStart', async (req: Request, res: Response) => {
  res.json(await InsightsService.getWeeklyReport(req.params.weekStart));
});

export default router;
