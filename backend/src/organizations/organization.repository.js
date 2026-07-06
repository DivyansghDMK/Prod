const { getPool } = require("../config/db");

class OrganizationRepository {
  constructor(pool = null) {
    this.pool = pool;
  }

  get db() {
    return this.pool || getPool();
  }

  async create(data) {
    const query = `
      INSERT INTO organizations (
        name, type, address, phone, email, gst, license_number, status, created_by, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'ACTIVE'), $9, NOW())
      RETURNING *;
    `;
    const values = [
      data.name,
      data.type,
      data.address || "",
      data.phone || "",
      data.email || "",
      data.gst || "",
      data.license_number || "",
      data.status || "ACTIVE",
      data.created_by || null,
    ];

    const { rows } = await this.db.query(query, values);
    return rows[0];
  }

  async findById(id) {
    const { rows } = await this.db.query("SELECT * FROM organizations WHERE id = $1", [id]);
    return rows[0] || null;
  }

  async findMany({ limit = 20, offset = 0 } = {}) {
    const { rows } = await this.db.query(
      `
        SELECT *
        FROM organizations
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );
    return rows;
  }

  async countAll() {
    const { rows } = await this.db.query("SELECT COUNT(*)::int AS count FROM organizations");
    return rows[0]?.count || 0;
  }

  async update(id, data) {
    const query = `
      UPDATE organizations
      SET
        name = COALESCE($2, name),
        type = COALESCE($3, type),
        address = COALESCE($4, address),
        phone = COALESCE($5, phone),
        email = COALESCE($6, email),
        gst = COALESCE($7, gst),
        license_number = COALESCE($8, license_number),
        status = COALESCE($9, status),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *;
    `;
    const values = [
      id,
      data.name ?? null,
      data.type ?? null,
      data.address ?? null,
      data.phone ?? null,
      data.email ?? null,
      data.gst ?? null,
      data.license_number ?? null,
      data.status ?? null,
    ];

    const { rows } = await this.db.query(query, values);
    return rows[0] || null;
  }

  async delete(id) {
    const { rowCount } = await this.db.query("DELETE FROM organizations WHERE id = $1", [id]);
    return rowCount > 0;
  }
}

function createOrganizationRepository(pool) {
  return new OrganizationRepository(pool);
}

module.exports = { OrganizationRepository, createOrganizationRepository };
