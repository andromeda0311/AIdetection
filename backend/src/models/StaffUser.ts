import { AppDataSource } from '../config/ormconfig.js';
import { StaffUser, RoleEnum } from '../entities/StaffUser.js';
import type { Role } from '../types/authUser.js';

export interface StaffUserRecord {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  first_name: string;
  last_name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SafeStaffUser {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface UpdateStaffData {
  firstName?: string;
  lastName?: string;
  role?: Role;
  isActive?: boolean;
}

const repo = () => AppDataSource.getRepository(StaffUser);

function mapEntity(entity: StaffUser): StaffUserRecord {
  return {
    id: entity.id,
    email: entity.email,
    password_hash: entity.passwordHash,
    role: entity.role as Role,
    first_name: entity.firstName,
    last_name: entity.lastName,
    is_active: entity.isActive,
    created_at: entity.createdAt,
    updated_at: entity.updatedAt,
  };
}

export function toSafeStaffUser(user: StaffUserRecord): SafeStaffUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.first_name,
    lastName: user.last_name,
    isActive: user.is_active,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export async function findByEmail(email: string): Promise<StaffUserRecord | null> {
  const entity = await repo().findOne({ where: { email } });
  return entity ? mapEntity(entity) : null;
}

export async function findById(id: string): Promise<StaffUserRecord | null> {
  const entity = await repo().findOne({ where: { id } });
  return entity ? mapEntity(entity) : null;
}

export async function listUsers(): Promise<StaffUserRecord[]> {
  const entities = await repo().find({ order: { createdAt: 'ASC' } });
  return entities.map(mapEntity);
}

export async function createUser(data: CreateStaffData): Promise<StaffUserRecord> {
  const entity = repo().create({
    email: data.email,
    passwordHash: data.passwordHash,
    role: data.role as RoleEnum,
    firstName: data.firstName,
    lastName: data.lastName,
  });
  const saved = await repo().save(entity);
  return mapEntity(saved);
}

export async function updateUser(id: string, data: UpdateStaffData): Promise<StaffUserRecord | null> {
  const entity = await repo().findOne({ where: { id } });
  if (!entity) return null;

  if (data.firstName !== undefined) entity.firstName = data.firstName;
  if (data.lastName !== undefined) entity.lastName = data.lastName;
  if (data.role !== undefined) entity.role = data.role as RoleEnum;
  if (data.isActive !== undefined) entity.isActive = data.isActive;

  const saved = await repo().save(entity);
  return mapEntity(saved);
}