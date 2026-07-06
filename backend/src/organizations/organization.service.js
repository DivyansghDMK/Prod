const { AppError } = require("../utils/AppError");
const { OrganizationRepository } = require("./organization.repository");
const { validateOrganizationPayload } = require("./organization.validation");

class OrganizationService {
  constructor(repository = new OrganizationRepository()) {
    this.repository = repository;
  }

  async createOrganization(payload) {
    const validation = validateOrganizationPayload(payload);
    if (!validation.ok) {
      throw new AppError("Validation failed", 400, validation.errors);
    }

    return this.repository.create(validation.data);
  }

  async listOrganizations({ page = 1, limit = 20 } = {}) {
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const offset = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.repository.findMany({ limit: safeLimit, offset }),
      this.repository.countAll(),
    ]);

    return {
      data: items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  async getOrganizationById(id) {
    const organization = await this.repository.findById(id);
    if (!organization) {
      throw new AppError("Organization not found", 404);
    }
    return organization;
  }

  async updateOrganization(id, payload) {
    const validation = validateOrganizationPayload(payload, { partial: true });
    if (!validation.ok) {
      throw new AppError("Validation failed", 400, validation.errors);
    }

    const organization = await this.repository.update(id, validation.data);
    if (!organization) {
      throw new AppError("Organization not found", 404);
    }
    return organization;
  }

  async deleteOrganization(id) {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new AppError("Organization not found", 404);
    }
    return true;
  }
}

function createOrganizationService(repository) {
  return new OrganizationService(repository);
}

module.exports = { OrganizationService, createOrganizationService };
