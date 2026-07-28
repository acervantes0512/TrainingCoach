import { Router, Request, Response } from 'express';
import * as MeasurementService from '../services/measurement.service.js';

const router = Router();

router.get('/:date', async (req: Request, res: Response) => {
  const measurement = await MeasurementService.getByDate(req.params.date);
  if (!measurement) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(measurement);
});

router.post('/', async (req: Request, res: Response) => {
  const { date, waist_cm, arm_right_cm, arm_left_cm, weight_kg } = req.body;
  if (!date || waist_cm == null || arm_right_cm == null || arm_left_cm == null || weight_kg == null) {
    res.status(400).json({ error: 'Missing required fields: date, waist_cm, arm_right_cm, arm_left_cm, weight_kg' });
    return;
  }
  const measurement = await MeasurementService.upsert({ date, waist_cm, arm_right_cm, arm_left_cm, weight_kg });
  res.status(201).json(measurement);
});

export default router;
