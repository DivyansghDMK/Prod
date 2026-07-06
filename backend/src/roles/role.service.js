const { HttpError } = require("../utils/httpError");
const { createRoleRepository } = require("./role.repository");
const { createPermissionRepository } = require("../permissions/permission.repository");
const { validateRolePayload } = require("./role.validation");

class RoleService {
  constructor(roleRepository = createRoleRepository(), permissionRepository = createPermissionRepository()) {
    this.roleRepository = roleRepository;
    this.permissionRepository = permissionRepository;
  }

  async createRole(payload) {
    const validation = validateRolePayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);
    return this.roleRepository.create(validation.data);
  }

  async listRoles({ page = 1, limit = 20 } = {}) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.roleRepository.findMany({ limit: safeLimit, offset }),
      this.roleRepository.countAll(),
    ]);
    return { data, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) || 1 } };
  }

  async getRoleById(id) {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new HttpError("Role not found", 404);
    const permissions = await this.permissionRepository.listByRoleId(id);
    return { ...role, permissions };
  }

  async updateRole(id, payload) {
    const validation = validateRolePayload(payload, { partial: true });
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);
    const role = await this.roleRepository.update(id, validation.data);
    if (!role) throw new HttpError("Role not found", 404);
    return role;
  }

  async deleteRole(id) {
    const deleted = await this.roleRepository.delete(id);
    if (!deleted) throw new HttpError("Role not found", 404);
    return true;
  }
}

function createRoleService(roleRepository, permissionRepository) {
  return new RoleService(roleRepository, permissionRepository);
}

module.exports = { RoleService, createRoleService };

