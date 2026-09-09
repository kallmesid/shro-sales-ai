import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.ts';
import { AuthRequest } from '../middleware/auth.ts';

export async function getAllUsers(req: AuthRequest, res: Response) {
  try {
    const result = await query(`
      SELECT u.id, u.name, u.username, u.email, u.role, u.access_level, u.status, u.report_to_id, u.created_at,
             mgr.name as report_to_name
      FROM users u
      LEFT JOIN users mgr ON u.report_to_id = mgr.id
      ORDER BY u.name ASC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
}

export async function createUser(req: AuthRequest, res: Response) {
  try {
    const { name, username, email, password, role, access_level, status = 'Active', report_to_id } = req.body;

    if (!name || !username || !email || !password || !role || !access_level) {
      return res.status(400).json({ error: 'All fields (name, username, email, password, role, access_level) are required.' });
    }

    // Check unique username & email
    const existing = await query('SELECT id FROM users WHERE username = $1 OR email = $2', [username.trim(), email.trim()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or Email is already in use.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(`
      INSERT INTO users (name, username, email, password_hash, role, access_level, status, report_to_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, name, username, email, role, access_level, status, report_to_id, created_at
    `, [
      name.trim(),
      username.trim(),
      email.trim(),
      passwordHash,
      role,
      access_level,
      status,
      report_to_id || null
    ]);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
}

export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { name, email, password, role, access_level, status, report_to_id } = req.body;

    const userRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const current = userRes.rows[0];
    let passwordHash = current.password_hash;

    if (password && password.trim() !== '') {
      passwordHash = await bcrypt.hash(password.trim(), 12);
    }

    const result = await query(`
      UPDATE users
      SET name = $1, email = $2, password_hash = $3, role = $4, access_level = $5, status = $6, report_to_id = $7
      WHERE id = $8
      RETURNING id, name, username, email, role, access_level, status, report_to_id
    `, [
      name ?? current.name,
      email ?? current.email,
      passwordHash,
      role ?? current.role,
      access_level ?? current.access_level,
      status ?? current.status,
      report_to_id !== undefined ? (report_to_id || null) : current.report_to_id,
      id
    ]);

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
}

// Returns potential approvers for each stage (Finance, Presales, Management, Operations, Logistics)
export async function getApproverCandidates(req: AuthRequest, res: Response) {
  try {
    const usersRes = await query(`
      SELECT id, name, username, email, role, access_level, status
      FROM users
      WHERE status = 'Active'
      ORDER BY name ASC
    `);

    const users = usersRes.rows;

    // Filter candidates for each stage:
    // Stage 1: Finance
    // Stage 2: Presales
    // Stage 3: Management
    // Stage 4: Operations
    // Stage 5: Logistics
    // Stage 6: Finance
    const candidates = {
      1: users.filter(u => u.role === 'Finance' || u.access_level === 'Admin'),
      2: users.filter(u => u.role === 'Presales' || u.access_level === 'Admin'),
      3: users.filter(u => u.role === 'Management' || u.access_level === 'Admin' || u.access_level === 'Management'),
      4: users.filter(u => u.role === 'Operations' || u.access_level === 'Admin'),
      5: users.filter(u => u.role === 'Logistics' || u.access_level === 'Admin'),
      6: users.filter(u => u.role === 'Finance' || u.access_level === 'Admin' || u.access_level === 'Management'),
      sales: users.filter(u => u.role === 'Sales' || u.access_level === 'User' || u.access_level === 'Admin'),
      all: users
    };

    return res.json(candidates);
  } catch (error) {
    console.error('Error fetching approver candidates:', error);
    return res.status(500).json({ error: 'Failed to fetch approvers' });
  }
}

export async function getTeams(req: AuthRequest, res: Response) {
  try {
    const teamsRes = await query(`
      SELECT t.*, u.name as lead_name
      FROM teams t
      LEFT JOIN users u ON t.lead_id = u.id
      ORDER BY t.name ASC
    `);

    const membersRes = await query(`
      SELECT tm.team_id, u.id as user_id, u.name, u.role, u.access_level
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
    `);

    const teams = teamsRes.rows.map(t => ({
      ...t,
      members: membersRes.rows.filter(m => m.team_id === t.id)
    }));

    return res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return res.status(500).json({ error: 'Failed to fetch teams' });
  }
}

export async function createTeam(req: AuthRequest, res: Response) {
  try {
    const { name, lead_id, member_ids = [] } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const teamRes = await query(`
      INSERT INTO teams (name, lead_id)
      VALUES ($1, $2)
      RETURNING *
    `, [name.trim(), lead_id || null]);

    const teamId = teamRes.rows[0].id;

    for (const userId of member_ids) {
      await query(`
        INSERT INTO team_members (team_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [teamId, userId]);
    }

    return res.status(201).json({ id: teamId, name: name.trim(), lead_id });
  } catch (error) {
    console.error('Error creating team:', error);
    return res.status(500).json({ error: 'Failed to create team' });
  }
}
