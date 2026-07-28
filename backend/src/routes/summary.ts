import { Router, Request, Response } from 'express';
import * as SummaryService from '../services/summary.service.js';

const router = Router();

router.get('/daily/:date', async (req: Request, res: Response) => {
  res.json(await SummaryService.getDailySummary(req.params.date));
});

router.get('/weekly/:weekStart', async (req: Request, res: Response) => {
  res.json(await SummaryService.getWeeklySummary(req.params.weekStart));
});

router.get('/history', async (req: Request, res: Response) => {
  const { metric, from, to } = req.query;
  if (!metric || !from || !to) {
    res.status(400).json({ error: 'metric, from, and to query params required' });
    return;
  }
  res.json(await SummaryService.getHistory(metric as string, from as string, to as string));
});

router.get('/progress', async (_req: Request, res: Response) => {
  res.json(await SummaryService.getGoalProgress());
});

export default router;
