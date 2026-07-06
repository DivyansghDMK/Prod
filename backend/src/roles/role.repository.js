const { getPool } = require("../config/db");

class RoleRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  async create(data) {
    const { rows } = await this.db.query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [data.name, data.description || ""]
    );
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.db.query("SELECT * FROM roles WHERE id = $1", [id]);
    return rows[0] || null;
  }

  async findByName(name) {
    const { rows } = await this.db.query("SELECT * FROM roles WHERE name = $1", [name]);
    return rows[0] || null;
  }

  async findMany({ limit = 20, offset = 0 } = {}) {
    const { rows } = await this.db.query(
      `SELECT *
       FROM roles
       ORDER BY name ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  async countAll() {
    const { rows } = await this.db.query("SELECT COUNT(*)::int AS count FROM roles");
    return rows[0]?.count || 0;
  }

  async update(id, data) {
    const { rows } = await this.db.query(
      `UPDATE roles
       SET name = COALESCE($2, name),
           description = COALESCE($3, description)
       WHERE id = $1
       RETURNING *`,
      [id, data.name ?? null, data.description ?? null]
    );
    return rows[0] || null;
  }

  async delete(id) {
    const { rowCount } = await this.db.query("DELETE FROM roles WHERE id = $1", [id]);
    return rowCount > 0;
  }
}

function createRoleRepository(pool) {
  return new RoleRepository(pool);
}

module.exports = { RoleRepository, createRoleRepository };

