/** Reservas. Uma reserva confirmada segura uma mesa livre com lugares suficientes. */

import type { Booking } from "../../src/types";
import { query, queryOne, withTransaction } from "../index";

const SELECT = `
  SELECT id, name, phone, email,
         booking_date AS date,
         booking_time AS time,
         people, notes, status
    FROM bookings
`;

type BookingRow = Booking & { date: string; time: string };

export interface NewBookingInput {
  name: string;
  phone?: string;
  email?: string;
  date: string;      // "2026-07-15"
  time: string;      // "20:30"
  people: number;
  notes?: string;
  /** Conta de cliente autenticada (o servidor decide, nunca o browser). */
  customerId?: string | null;
}

export async function listBookings(limit = 200): Promise<Booking[]> {
  return query<BookingRow>(`${SELECT} ORDER BY booking_date DESC, booking_time DESC LIMIT $1`, [limit]);
}

export async function createBooking(input: NewBookingInput): Promise<Booking> {
  if (!input.name?.trim()) throw new Error("O nome da reserva é obrigatório.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) throw new Error("Data inválida (use AAAA-MM-DD).");
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(input.time ?? "")) throw new Error("Hora inválida (use HH:MM).");

  const people = Number(input.people);
  if (!Number.isInteger(people) || people < 1 || people > 40) {
    throw new Error("Número de pessoas tem de estar entre 1 e 40.");
  }

  return withTransaction(async (client) => {
    const { rows: idRows } = await client.query<{ id: string }>(
      "SELECT 'BK-' || nextval('bookings_id_seq') AS id"
    );
    const id = idRows[0].id;

    // mesa livre com lugares suficientes (pode não haver)
    const { rows: tableRows } = await client.query<{ id: string }>(
      `SELECT id FROM restaurant_tables
        WHERE status = 'livre' AND capacity >= $1
        ORDER BY capacity, id LIMIT 1`,
      [people]
    );
    const tableId = tableRows[0]?.id ?? null;

    const { rows } = await client.query<BookingRow>(
      `INSERT INTO bookings
         (id, name, phone, email, booking_date, booking_time, people, table_id, notes, status, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'confirmado',$10)
       RETURNING id, name, phone, email, booking_date AS date, booking_time AS time,
                 people, notes, status`,
      [id, input.name.trim(), input.phone ?? "", input.email ?? "", input.date,
       input.time, people, tableId, input.notes ?? "", input.customerId ?? null]
    );

    if (tableId) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'reservada' WHERE id = $1",
        [tableId]
      );
    }

    return rows[0];
  });
}

export async function updateBookingStatus(id: string, status: Booking["status"]): Promise<Booking | null> {
  const valid: Booking["status"][] = ["confirmado", "cancelado", "concluido"];
  if (!valid.includes(status)) throw new Error(`Estado de reserva inválido: "${status}".`);

  const row = await queryOne<BookingRow>(
    `UPDATE bookings SET status = $2 WHERE id = $1
     RETURNING id, name, phone, email, booking_date AS date, booking_time AS time,
               people, notes, status`,
    [id, status]
  );
  return row;
}
