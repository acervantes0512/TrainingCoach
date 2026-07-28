import { Router, Request, Response } from 'express';
import * as MealService from '../services/meal.service.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const date = req.query.date as string;
  if (!date) {
    res.status(400).json({ error: 'date query param required' });
    return;
  }
  res.json(await MealService.getByDate(date));
});

router.post('/', async (req: Request, res: Response) => {
  const { date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_url } = req.body;
  if (!date || !meal_type || !description || calories == null || protein_g == null || carbs_g == null || fat_g == null) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  const validTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'shake'];
  if (!validTypes.includes(meal_type)) {
    res.status(400).json({ error: 'Invalid meal_type. Must be: breakfast, lunch, dinner, snack, shake' });
    return;
  }
  const meal = await MealService.create({ date, meal_type, description, calories, protein_g, carbs_g, fat_g, photo_url });
  res.status(201).json(meal);
});

router.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const meal = await MealService.update(id, req.body);
  if (!meal) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(meal);
});

router.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const deleted = await MealService.remove(id);
  if (!deleted) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.status(204).send();
});

export default router;
