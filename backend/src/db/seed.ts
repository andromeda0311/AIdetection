import { AppDataSource, initDB } from '../config/ormconfig.js';
import config from '../config/env.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../services/password.service.js';
import { StaffUser, RoleEnum } from '../entities/StaffUser.js';

async function seed(): Promise<void> {
  const { email, password } = config.admin;

  if (!email || !password) {
    logger.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment before seeding.');
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    logger.error('ADMIN_PASSWORD must be at least 8 characters long.');
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
}

seed()
  .catch((err) => {
    logger.error({ err }, 'Seeding failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });