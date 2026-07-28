import { Router, Request, Response } from 'express';
import * as SupplementService from '../services/supplement.service.js';

const router = Router();

router.get('/:date', async (req: Request, res: Response) => {
  res.json(await SupplementService.getByDate(req.params.date));
});

router.post('/toggle', async (req: Request, res: Response) => {
  const { date, supplement_type, taken } = req.body;
  if (!date || !supplement_type) {
    res.status(400).json({ error: 'date and supplement_type required' });
    return;
  }
  res.json(await SupplementService.toggle(date, supplement_type, taken));
});

export default router;
