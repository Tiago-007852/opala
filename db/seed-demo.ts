/**
 * Dados de demonstração — pedidos, reservas, clientes e lançamentos.
 * NÃO faz parte da instalação real do restaurante.
 *
 *   npm run db:seed:demo
 *
 * Idempotente: corre quantas vezes quiser sem duplicar.
 */

import { closePool, databaseUrl, describeDbError, query, withTransaction } from "./index";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

type Dish = { id: string; name: string; price: number };

async function pickDishes(): Promise<Dish[]> {
  const rows = await query<Dish>(
    `SELECT id, name, price FROM menu_items
      WHERE is_active AND category IN ('principais', 'petiscos', 'bebidas')
      ORDER BY category, price DESC
      LIMIT 4`
  );
  if (rows.length < 2) throw new Error("Cardápio vazio. Corra npm run db:seed primeiro.");
  return rows;
}

async function main() {
  if (!databaseUrl()) {
    console.error("✖ DATABASE_URL não está definida (ver .env.example).");
    process.exitCode = 1;
    return;
  }

  try {
    const dishes = await pickDishes();
    const [dishA, dishB, dishC = dishB] = dishes;

    await withTransaction(async (client) => {
      // ---------------------------------------------------------- clientes
      await client.query(
        `INSERT INTO customers (id, name, email, phone, total_spent, visits, favorite_dish, birthday, loyalty_points)
         VALUES
           ('c1','Alexandre Gombo','alexandre.gombo@uol.co.ao','+244 923 721 001',284000,12,$1,'10 de Outubro',2800),
           ('c2','Camila Ndalu','camila.ndalu@gmail.com','+244 923 121 889',195050,8,$2,'22 de Janeiro',1950),
           ('c3','Rodolfo Bento','rodolfo.bento@outlook.com','+244 931 111 224',420000,18,$1,'15 de Dezembro',4200),
           ('c4','Fernanda Kiala','fefe.kiala@gmail.com','+244 923 000 111',85000,3,$2,'03 de Março',850)
         ON CONFLICT (id) DO NOTHING`,
        [dishA.name, dishB.name]
      );

      // ----------------------------------------------------------- pedido 1
      const order1Items = [
        { dish: dishA, quantity: 2 },
        { dish: dishC, quantity: 1 },
      ];
      const order1Subtotal = round2(
        order1Items.reduce((sum, item) => sum + item.dish.price * item.quantity, 0)
      );
      const order1Tax = round2(order1Subtotal * 0.1);
      const order1Total = round2(order1Subtotal + order1Tax);

      const inserted1 = await client.query<{ id: string }>(
        `INSERT INTO orders
           (id, table_id, customer_id, customer_name, subtotal, tax, discount, total,
            payment_method, status, notes)
         VALUES ('OP-8401','08','c1','Alexandre Gombo',$1,$2,0,$3,'cartao','preparando',
                 'Por favor, tragam o funge bem quente.')
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [order1Subtotal, order1Tax, order1Total]
      );

      if (inserted1.rows.length > 0) {
        for (let i = 0; i < order1Items.length; i++) {
          const { dish, quantity } = order1Items[i];
          await client.query(
            `INSERT INTO order_items
               (order_id, menu_item_id, item_name, unit_price, quantity, extras,
                selected_sauce, notes, line_total, position)
             VALUES ('OP-8401',$1,$2,$3,$4,'[]'::jsonb,'','',$5,$6)`,
            [dish.id, dish.name, dish.price, quantity, round2(dish.price * quantity), i]
          );
        }
        await client.query(
          `UPDATE restaurant_tables SET status = 'ocupada', active_order_id = 'OP-8401'
            WHERE id = '08' AND active_order_id IS NULL`
        );
        await client.query(
          `INSERT INTO financial_records (id, description, amount, type, category, order_id, customer_id)
           VALUES ('f-demo-1','Pedido OP-8401 - Mesa 08',$1,'receita','Alimentação','OP-8401','c1')
           ON CONFLICT (id) DO NOTHING`,
          [order1Total]
        );
      }

      // ----------------------------------------------------------- pedido 2
      const order2Subtotal = round2(dishB.price * 1);
      const order2Tax = round2(order2Subtotal * 0.1);
      const order2Discount = round2(Math.min(2500, order2Subtotal + order2Tax));
      const order2Total = round2(order2Subtotal + order2Tax - order2Discount);

      const inserted2 = await client.query<{ id: string }>(
        `INSERT INTO orders
           (id, table_id, customer_id, customer_name, subtotal, tax, discount, total,
            payment_method, status, notes)
         VALUES ('OP-8402','03','c2','Camila Ndalu',$1,$2,$3,$4,'online','recebido','')
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [order2Subtotal, order2Tax, order2Discount, order2Total]
      );

      if (inserted2.rows.length > 0) {
        await client.query(
          `INSERT INTO order_items
             (order_id, menu_item_id, item_name, unit_price, quantity, extras,
              selected_sauce, notes, line_total, position)
           VALUES ('OP-8402',$1,$2,$3,1,'[]'::jsonb,'','',$3,0)`,
          [dishB.id, dishB.name, dishB.price]
        );
        await client.query(
          `UPDATE restaurant_tables SET status = 'ocupada', active_order_id = 'OP-8402'
            WHERE id = '03' AND active_order_id IS NULL`
        );
        await client.query(
          `INSERT INTO financial_records (id, description, amount, type, category, order_id, customer_id)
           VALUES ('f-demo-2','Pedido OP-8402 - Mesa 03',$1,'receita','Alimentação','OP-8402','c2')
           ON CONFLICT (id) DO NOTHING`,
          [order2Total]
        );
      }

      // ------------------------------------------------------------ reservas
      await client.query(
        `INSERT INTO bookings (id, name, phone, email, booking_date, booking_time, people, notes, status)
         VALUES
           ('BK-1002','Bernardo Caxinde','+244 923 765 432','bernardo.caxinde@gmail.com',
            CURRENT_DATE + 1,'20:30',4,'Mesa próxima à janela. Aniversário de casamento.','confirmado'),
           ('BK-1003','Mariana Kiala','+244 931 888 776','mariana.kiala@hotmail.com',
            CURRENT_DATE + 2,'19:00',2,'Restrição severa a glúten.','confirmado')
         ON CONFLICT (id) DO NOTHING`
      );

      // --------------------------------------------------------- despesas
      await client.query(
        `INSERT INTO financial_records (id, description, amount, type, category, occurred_at)
         VALUES
           ('f-demo-3','Compra Peixe Fresco - Porto de Luanda',120000,'despesa','Insumos',now() - interval '1 day'),
           ('f-demo-4','Pagamento Distribuidora de Gás Luanda',45000,'despesa','Manutenção',now() - interval '1 day'),
           ('f-demo-5','Venda Mesa 04',32000,'receita','Alimentação',now() - interval '2 days')
         ON CONFLICT (id) DO NOTHING`
      );
    });

    console.log("✓ Dados de demonstração aplicados (2 pedidos, 2 reservas, 4 clientes, 5 lançamentos).");
  } catch (error) {
    console.error("✖ Falha no seed de demonstração:", describeDbError(error));
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
