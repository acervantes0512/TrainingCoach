import { Router, Request, Response } from 'express';
import * as GoalService from '../services/goal.service.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  res.json(await GoalService.getAll());
});

router.get('/active', async (_req: Request, res: Response) => {
  res.json(await GoalService.getActive());
});

router.get('/progress', async (_req: Request, res: Response) => {
  res.json(await GoalService.getAllProgress());
});

router.get('/:id', async (req: Request, res: Response) => {
  const goal = await GoalService.getById(Number(req.params.id));
  if (!goal) { res.status(404).json({ error: 'Goal not found' }); return; }
  res.json(goal);
});

router.get('/:id/progress', async (req: Request, res: Response) => {
  const progress = await GoalService.getProgress(Number(req.params.id));
  if (!progress) { res.status(404).json({ error: 'Goal not found' }); return; }
  res.json(progress);
});

router.post('/', async (req: Request, res: Response) => {
  res.json(await GoalService.create(req.body));
});

router.put('/:id', async (req: Request, res: Response) => {
  const goal = await GoalService.update(Number(req.params.id), req.body);
  if (!goal) { res.status(404).json({ error: 'Goal not found' }); return; }
  res.json(goal);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const deleted = await GoalService.remove(Number(req.params.id));
  res.json({ deleted });
});

export default router;
