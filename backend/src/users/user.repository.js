const { getPool } = require("../config/db");

class UserRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  async create(data) {
    const { rows } = await this.db.query(
      `INSERT INTO users (
        organization_id, full_name, email, phone, role_id, password_hash, status
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'ACTIVE'))
      RETURNING *`,
      [
        data.organization_id,
        data.full_name,
        data.email || "",
        data.phone || "",
        data.role_id,
        data.password_hash ?? null,
        data.status || "ACTIVE",
      ]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.db.query(
      `SELECT u.*, r.name AS role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  async findMany({ limit = 20, offset = 0, organizationId = null } = {}) {
    const query = `
      SELECT u.*, r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      ${organizationId ? "WHERE u.organization_id = $3" : ""}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const values = organizationId ? [limit, offset, organizationId] : [limit, offset];
    const { rows } = await this.db.query(query, values);
    return rows;
  }

  async countAll({ organizationId = null } = {}) {
    const query = organizationId
      ? "SELECT COUNT(*)::int AS count FROM users WHERE organization_id = $1"
      : "SELECT COUNT(*)::int AS count FROM users";
    const values = organizationId ? [organizationId] : [];
    const { rows } = await this.db.query(query, values);
    return rows[0]?.count || 0;
  }

  async update(id, data) {
    const { rows } = await this.db.query(
      `UPDATE users
       SET organization_id = COALESCE($2, organization_id),
           full_name = COALESCE($3, full_name),
           email = COALESCE($4, email),
           phone = COALESCE($5, phone),
           role_id = COALESCE($6, role_id),
           password_hash = COALESCE($7, password_hash),
           status = COALESCE($8, status)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.organization_id ?? null,
        data.full_name ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.role_id ?? null,
        data.password_hash ?? null,
        data.status ?? null,
      ]
    );
    return rows[0] || null;
  }

  async delete(id) {
    const { rowCount } = await this.db.query("DELETE FROM users WHERE id = $1", [id]);
    return rowCount > 0;
  }
}

function createUserRepository(pool) {
  return new UserRepository(pool);
}

module.exports = { UserRepository, createUserRepository };

