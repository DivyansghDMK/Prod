const { getPool } = require("../config/db");

class PermissionRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  async create(data) {
    const { rows } = await this.db.query(
      `INSERT INTO permissions (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [data.name, data.description || ""]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.db.query("SELECT * FROM permissions WHERE id = $1", [id]);
    return rows[0] || null;
  }

  async findByName(name) {
    const { rows } = await this.db.query("SELECT * FROM permissions WHERE name = $1", [name]);
    return rows[0] || null;
  }

  async findMany({ limit = 50, offset = 0 } = {}) {
    const { rows } = await this.db.query(
      `SELECT *
       FROM permissions
       ORDER BY name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  async countAll() {
    const { rows } = await this.db.query("SELECT COUNT(*)::int AS count FROM permissions");
    return rows[0]?.count || 0;
  }

  async update(id, data) {
    const { rows } = await this.db.query(
      `UPDATE permissions
       SET name = COALESCE($2, name),
           description = COALESCE($3, description)
       WHERE id = $1
       RETURNING *`,
      [id, data.name ?? null, data.description ?? null]
    );
    return rows[0] || null;
  }

  async delete(id) {
    const { rowCount } = await this.db.query("DELETE FROM permissions WHERE id = $1", [id]);
    return rowCount > 0;
  }

  async listByRoleId(roleId) {
    const { rows } = await this.db.query(
      `SELECT p.*
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = $1
       ORDER BY p.name ASC`,
      [roleId]
    );
    return rows;
  }

  async setRolePermissions(roleId, permissionIds) {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);
      for (const permissionId of permissionIds) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [roleId, permissionId]
        );
      }
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

function createPermissionRepository(pool) {
  return new PermissionRepository(pool);
}

module.exports = { PermissionRepository, createPermissionRepository };

