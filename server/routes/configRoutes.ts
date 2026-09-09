import { Router } from 'express';
import { getDropdowns, addDropdownItem, deleteDropdownItem } from '../controllers/configController.ts';
import { verifyJWT, requireAdmin } from '../middleware/auth.ts';

const router = Router();

router.use(verifyJWT);

router.get('/dropdowns', getDropdowns);
router.post('/dropdowns', requireAdmin, addDropdownItem);
router.delete('/dropdowns/:id', requireAdmin, deleteDropdownItem);

export default router;
