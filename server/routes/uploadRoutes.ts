import { Router } from 'express';
import {
  upload,
  uploadCostSheetAttachment,
  parsePdfForLineItems,
  getNotifications,
  markNotificationRead,
} from '../controllers/uploadController.ts';
import { verifyJWT } from '../middleware/auth.ts';

const router = Router();

router.use(verifyJWT);

router.post('/attachment', upload.single('file'), uploadCostSheetAttachment);
router.post('/parse-pdf-lines', upload.single('file'), parsePdfForLineItems);
router.get('/notifications', getNotifications);
router.post('/notifications/:id/read', markNotificationRead);

export default router;
