const { HttpError } = require("../utils/httpError");
const { createPermissionRepository } = require("./permission.repository");
const { createRoleRepository } = require("../roles/role.repository");
const { validatePermissionPayload, validateRolePermissionsPayload } = require("./permission.validation");

class PermissionService {
  constructor(permissionRepository = createPermissionRepository(), roleRepository = createRoleRepository()) {
    this.permissionRepository = permissionRepository;
    this.roleRepository = roleRepository;
  }

  async createPermission(payload) {
    const validation = validatePermissionPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);
    return this.permissionRepository.create(validation.data);
  }

  async listPermissions({ page = 1, limit = 50 } = {}) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offset = (safePage - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.permissionRepository.findMany({ limit: safeLimit, offset }),
      this.permissionRepository.countAll(),
    ]);
    return { data, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) || 1 } };
  }

  async getPermissionById(id) {
    const permission = await this.permissionRepository.findById(id);
    if (!permission) throw new HttpError("Permission not found", 404);
    return permission;
  }

  async updatePermission(id, payload) {
    const validation = validatePermissionPayload(payload, { partial: true });
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);
    const permission = await this.permissionRepository.update(id, validation.data);
    if (!permission) throw new HttpError("Permission not found", 404);
    return permission;
  }

  async deletePermission(id) {
    const deleted = await this.permissionRepository.delete(id);
    if (!deleted) throw new HttpError("Permission not found", 404);
    return true;
  }

  async listPermissionsByRole(roleId) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) throw new HttpError("Role not found", 404);
    return this.permissionRepository.listByRoleId(roleId);
  }

  async setRolePermissions(payload) {
    const validation = validateRolePermissionsPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const role = await this.roleRepository.findById(validation.data.role_id);
    if (!role) throw new HttpError("Role not found", 404);

    for (const permissionId of validation.data.permission_ids) {
      const permission = await this.permissionRepository.findById(permissionId);
      if (!permission) throw new HttpError(`Permission not found: ${permissionId}`, 404);
    }

    await this.permissionRepository.setRolePermissions(validation.data.role_id, validation.data.permission_ids);
    return this.permissionRepository.listByRoleId(validation.data.role_id);
  }
}

function createPermissionService(permissionRepository, roleRepository) {
  return new PermissionService(permissionRepository, roleRepository);
}

module.exports = { PermissionService, createPermissionService };

