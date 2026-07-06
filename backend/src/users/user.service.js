const { HttpError } = require("../utils/httpError");
const { createUserRepository } = require("./user.repository");
const { createRoleRepository } = require("../roles/role.repository");
const { validateUserPayload } = require("./user.validation");

class UserService {
  constructor(userRepository = createUserRepository(), roleRepository = createRoleRepository()) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
  }

  async createUser(payload, caller = {}) {
    const validation = validateUserPayload(payload);
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    // Enforce organization scoping
    if (caller.role !== "SUPER_ADMIN") {
      if (!caller.organization?.id) throw new HttpError("Organization context missing", 403);
      data.organization_id = caller.organization.id;
    }

    const role = await this.roleRepository.findById(data.role_id);
    if (!role) throw new HttpError("Role not found", 404);

    // Prevent privilege escalation: non-SUPER_ADMIN cannot assign SUPER_ADMIN role
    if (role.name === "SUPER_ADMIN" && caller.role !== "SUPER_ADMIN") {
      throw new HttpError("Forbidden: Cannot assign SUPER_ADMIN role", 403);
    }

    return this.userRepository.create(data);
  }

  async listUsers(query = {}, caller = {}) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    
    // Scoping check
    let organizationId = query.organization_id || null;
    if (caller.role !== "SUPER_ADMIN") {
      organizationId = caller.organization?.id || null;
    }

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;
    const [data, total] = await Promise.all([
      this.userRepository.findMany({ limit: safeLimit, offset, organizationId }),
      this.userRepository.countAll({ organizationId }),
    ]);
    return { data, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) || 1 } };
  }

  async getUserById(id, caller = {}) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new HttpError("User not found", 404);

    // Enforce scoping
    if (caller.role !== "SUPER_ADMIN" && user.organization_id !== caller.organization?.id) {
      throw new HttpError("User not found", 404); // opaque
    }

    return user;
  }

  async updateUser(id, payload, caller = {}) {
    // Verify visibility
    await this.getUserById(id, caller);

    const validation = validateUserPayload(payload, { partial: true });
    if (!validation.ok) throw new HttpError("Validation failed", 400, validation.errors);

    const data = validation.data;

    // Enforce scoping: block altering org
    if (caller.role !== "SUPER_ADMIN" && data.organization_id && data.organization_id !== caller.organization?.id) {
      throw new HttpError("Forbidden: Cannot move user to another organization", 403);
    }

    if (data.role_id) {
      const role = await this.roleRepository.findById(data.role_id);
      if (!role) throw new HttpError("Role not found", 404);

      // Prevent privilege escalation
      if (role.name === "SUPER_ADMIN" && caller.role !== "SUPER_ADMIN") {
        throw new HttpError("Forbidden: Cannot assign SUPER_ADMIN role", 403);
      }
    }

    const user = await this.userRepository.update(id, data);
    if (!user) throw new HttpError("User not found", 404);
    return user;
  }

  async deleteUser(id, caller = {}) {
    // Verify visibility
    await this.getUserById(id, caller);

    const deleted = await this.userRepository.delete(id);
    if (!deleted) throw new HttpError("User not found", 404);
    return true;
  }
}

function createUserService(userRepository, roleRepository) {
  return new UserService(userRepository, roleRepository);
}

module.exports = { UserService, createUserService };

