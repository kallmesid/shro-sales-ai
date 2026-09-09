import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';
import { parsePdfBuffer } from '../services/pdfParserService.ts';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

export async function uploadCostSheetAttachment(req: AuthRequest, res: Response) {
  try {
    const file = req.file;
    const { cost_sheet_id } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (!cost_sheet_id) {
      return res.status(400).json({ error: 'cost_sheet_id is required' });
    }

    const result = await query(`
      INSERT INTO uploaded_files (cost_sheet_id, filename, original_name, file_path, file_size, mime_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      cost_sheet_id,
      file.filename,
      file.originalname,
      `/uploads/${file.filename}`,
      file.size,
      file.mimetype
    ]);

    return res.status(201).json({
      message: 'File uploaded and metadata stored successfully',
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Error handling upload:', error);
    return res.status(500).json({ error: 'Failed to upload attachment' });
  }
}

export async function parsePdfForLineItems(req: AuthRequest, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No PDF file provided.' });
    }

    const fileBuffer = fs.readFileSync(file.path);
    const parsedLineItems = await parsePdfBuffer(fileBuffer);

    return res.json({
      message: `Parsed ${parsedLineItems.length} candidate line items from PDF.`,
      items: parsedLineItems
    });
  } catch (error: any) {
    console.error('PDF parsing error in uploadController:', error);
    return res.status(500).json({ error: error.message || 'Failed to parse PDF document' });
  }
}

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const result = await query(`
      SELECT n.*, cs.cs_number
      FROM notifications n
      LEFT JOIN cost_sheets cs ON n.cost_sheet_id = cs.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 20
    `, [req.user.id]);

    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}

export async function markNotificationRead(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = TRUE WHERE id = $1', [id]);
    return res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error updating notification:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
}
