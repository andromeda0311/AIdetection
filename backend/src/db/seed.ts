import { AppDataSource, initDB } from '../config/ormconfig.js';
import config from '../config/env.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/password.service.js';
import { StaffUser, RoleEnum } from '../entities/StaffUser.js';
import { RefreshToken } from '../entities/RefreshToken.js';
import { IsNull, Not } from 'typeorm';
import { adminPasswordProblem } from '../services/adminPolicy.js';

/**
 * Creates or resets THE administrator. The system has exactly one account, so
 * every other account is deactivated and its sessions are revoked.
 */
async function seed(): Promise<void> {
  const { email, password } = config.admin;

  if (!email || !password) {
    logger.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment before seeding.');
    process.exitCode = 1;
    return;
  }

  const problem = adminPasswordProblem(password);
  if (problem) {
    logger.error(problem);
    process.exitCode = 1;
    return;
  }

  await initDB();

  const repo = AppDataSource.getRepository(StaffUser);
  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await hashPassword(password);

  const existing = await repo.findOne({ where: { email: normalizedEmail } });

  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = RoleEnum.ADMIN;
    existing.isActive = true;
    await repo.save(existing);
    logger.info({ email: normalizedEmail }, 'Admin user already existed; credentials updated.');
  } else {
    const entity = repo.create({
      email: normalizedEmail,
      passwordHash,
      role: RoleEnum.ADMIN,
      firstName: 'Admin',
      lastName: 'User',
    });
    await repo.save(entity);
    logger.info({ email: normalizedEmail }, 'Admin user created.');
  }

  // Single-admin rule: no other account may stay usable.
  const others = await repo.find({ where: { email: Not(normalizedEmail) } });
  if (others.length) {
    const ids = others.map((user) => user.id);
    await repo.update(ids, { isActive: false });
    for (const id of ids) {
      await AppDataSource.getRepository(RefreshToken).update({ userId: id, revokedAt: IsNull() }, { revokedAt: new Date() });
    }
    logger.warn({ deactivated: others.map((user) => user.email) }, 'Other accounts deactivated (single administrator).');
  }
}

seed()
  .catch((err) => {
    logger.error({ err }, 'Seeding failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });
