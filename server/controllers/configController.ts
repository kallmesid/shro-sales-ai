import { Response } from 'express';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

export async function getDropdowns(req: AuthRequest, res: Response) {
  try {
    const result = await query(`
      SELECT * FROM dropdown_options WHERE is_active = TRUE ORDER BY category ASC, name ASC
    `);

    const grouped: { [key: string]: string[] } = {
      business_unit: [],
      oem: [],
      distributor: []
    };

    for (const item of result.rows) {
      if (grouped[item.category]) {
        grouped[item.category].push(item.name);
      }
    }

    return res.json({
      raw: result.rows,
      grouped
    });
  } catch (error) {
    console.error('Error fetching dropdowns:', error);
    return res.status(500).json({ error: 'Failed to fetch dropdown options' });
  }
}

export async function addDropdownItem(req: AuthRequest, res: Response) {
  try {
    const { category, name } = req.body;
    if (!category || !name || name.trim() === '') {
      return res.status(400).json({ error: 'Category and Name are required' });
    }

    const existing = await query('SELECT id FROM dropdown_options WHERE category = $1 AND name = $2', [category, name.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Option already exists in this category' });
    }

    const result = await query(`
      INSERT INTO dropdown_options (category, name)
      VALUES ($1, $2)
      RETURNING *
    `, [category, name.trim()]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding dropdown item:', error);
    return res.status(500).json({ error: 'Failed to add option' });
  }
}

export async function deleteDropdownItem(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    await query('DELETE FROM dropdown_options WHERE id = $1', [id]);
    return res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    console.error('Error deleting dropdown item:', error);
    return res.status(500).json({ error: 'Failed to delete option' });
  }
}
