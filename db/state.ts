/**
 * Estado completo do sistema, no mesmo formato que GET /api/state devolvia
 * (era um único objeto em memória). Fica pronto para o server trocar o
 * array em RAM por esta função.
 */

import type {
  Booking,
  Coupon,
  Customer,
  Employee,
  FinancialRecord,
  InventoryItem,
  MenuItem,
  Order,
  Table,
} from "../src/types";
import { listMenuItems } from "./repositories/menu";
import { listOrders } from "./repositories/orders";
import { listTables } from "./repositories/tables";
import { listBookings } from "./repositories/bookings";
import { listEmployees } from "./repositories/employees";
import { listInventory } from "./repositories/inventory";
import { listFinancialRecords } from "./repositories/finance";
import { listCustomers } from "./repositories/customers";
import { listCoupons } from "./repositories/coupons";

export interface AppState {
  menuItems: MenuItem[];
  orders: Order[];
  tables: Table[];
  bookings: Booking[];
  employees: Employee[];
  inventory: InventoryItem[];
  financialRecords: FinancialRecord[];
  customers: Customer[];
  coupons: Coupon[];
}

export async function loadState(): Promise<AppState> {
  const [
    menuItems,
    orders,
    tables,
    bookings,
    employees,
    inventory,
    financialRecords,
    customers,
    coupons,
  ] = await Promise.all([
    listMenuItems(),
    listOrders(),
    listTables(),
    listBookings(),
    listEmployees(),
    listInventory(),
    listFinancialRecords(),
    listCustomers(),
    listCoupons(),
  ]);

  return {
    menuItems,
    orders,
    tables,
    bookings,
    employees,
    inventory,
    financialRecords,
    customers,
    coupons,
  };
}
