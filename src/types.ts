export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'pequeno-almoco' | 'entradas' | 'petiscos' | 'principais' | 'massas' | 'carnes' | 'peixes' | 'fastfood' | 'sobremesas' | 'bebidas';
  image: string;
  ingredients: string[];
  averageTime: number; // in minutes
  tags: ('Novo' | 'Mais vendido' | 'Promoção' | 'Vegano' | 'Sem Glúten' | 'Picante')[];
  nutritionalValue?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  extras: { name: string; price: number }[];
  sauces: string[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  selectedExtras: { name: string; price: number }[];
  selectedSauce: string;
  notes: string;
}

export type OrderStatus = 'recebido' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';

export interface Order {
  id: string;
  tableId: string; // empty if delivery/local without table
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cartao' | 'transferência' | 'dinheiro' | 'online';
  status: OrderStatus;
  timestamp: string;
  notes?: string;
  customerName?: string;
}

export interface Booking {
  id: string;
  name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  people: number;
  notes?: string;
  status: 'confirmado' | 'cancelado' | 'concluido';
}

export interface Table {
  id: string;
  status: 'livre' | 'ocupada' | 'reservada' | 'pagamento';
  activeOrderId?: string;
  waiterName?: string;
  capacity: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  photo: string;
  shift: string;
  phone: string;
  email: string;
  permissions: string[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minLimit: number;
  category: string;
  lastUpdated: string;
}

export interface FinancialRecord {
  id: string;
  description: string;
  amount: number;
  type: 'receita' | 'despesa';
  category: string;
  date: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSpent: number;
  visits: number;
  favoriteDish: string;
  birthday: string;
  loyaltyPoints: number;
}

export interface Coupon {
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
  active: boolean;
  minSpend?: number;
}
