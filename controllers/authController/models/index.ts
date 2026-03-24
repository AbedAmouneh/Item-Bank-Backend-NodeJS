import { Role } from '../../../types/common';

export interface UserSession {
  id: number;
  userId: number;
  token: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  fingerprint: string;
  isActive: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastActivityAt: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginUser {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  tenant_id: number;
  roles: string[];
}

export interface LoginResponse {
  user: LoginUser;
  token: string;
  refreshToken: string;
  expiresIn: string;
  csrf_token: string;
}

export interface User {
  id: number;
  email: string;
  role: Role;
  is_active: boolean;
  tenant_id: number;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export type { CreateUserRequest } from '../../../types/api/users';
