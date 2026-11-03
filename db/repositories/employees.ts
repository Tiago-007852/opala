/** Equipa do restaurante. `permissions` é a lista de poderes do funcionário. */

import type { Employee } from "../../src/types";
import { query, queryOne } from "../index";

const SELECT = `
  SELECT id, name, role, photo, shift, phone, email, permissions,
         is_active AS "isActive"
    FROM employees
`;

type EmployeeRow = Employee & { isActive: boolean };

export async function listEmployees(options: { includeInactive?: boolean } = {}): Promise<Employee[]> {
  const where = options.includeInactive ? "" : " WHERE is_active";
  return query<EmployeeRow>(`${SELECT}${where} ORDER BY name`);
}

export interface EmployeeInput {
  name: string;
  role?: string;
  photo?: string;
  shift?: string;
  phone?: string;
  email?: string;
  permissions?: string[];
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  if (!input.name?.trim()) throw new Error("O nome do funcionário é obrigatório.");

  const row = await queryOne<EmployeeRow>(
    `INSERT INTO employees
       (id, name, role, photo, shift, phone, email, permissions)
     VALUES ('E-' || lpad(nextval('employees_id_seq')::text, 2, '0'),
             $1,$2,$3,$4,$5,$6,$7)
     RETURNING id, name, role, photo, shift, phone, email, permissions, is_active AS "isActive"`,
    [
      input.name.trim(),
      input.role ?? "",
      input.photo ?? "",
      input.shift ?? "",
      input.phone ?? "",
      input.email ?? "",
      input.permissions ?? [],
    ]
  );
  if (!row) throw new Error("Não foi possível criar o funcionário.");
  return row;
}

export async function updateEmployee(id: string, patch: Partial<EmployeeInput>): Promise<Employee | null> {
  const columns: Record<string, string> = {
    name: "name",
    role: "role",
    photo: "photo",
    shift: "shift",
    phone: "phone",
    email: "email",
    permissions: "permissions",
  };

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return queryOne<EmployeeRow>(`${SELECT} WHERE id = $1`, [id]);

  const row = await queryOne<EmployeeRow>(
    `UPDATE employees SET ${sets.join(", ")} WHERE id = $${params.length + 1}
     RETURNING id, name, role, photo, shift, phone, email, permissions, is_active AS "isActive"`,
    [...params, id]
  );
  return row;
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE employees SET is_active = false WHERE id = $1 RETURNING id",
    [id]
  );
  return rows.length > 0;
}
