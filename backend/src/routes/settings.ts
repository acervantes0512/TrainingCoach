import { Router, Request, Response } from 'express';
import * as SettingsService from '../services/settings.service.js';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  res.json(await SettingsService.get());
});

router.put('/', async (req: Request, res: Response) => {
  const settings = await SettingsService.update(req.body);
  res.json(settings);
});

export default router;
