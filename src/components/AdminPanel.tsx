import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BarChart3, 
  Layers, 
  Smartphone, 
  Users, 
  Settings, 
  ChevronRight, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Grid, 
  Clock, 
  Plus, 
  Trash2, 
  Edit3, 
  QrCode, 
  FileText, 
  Check, 
  X, 
  AlertTriangle, 
  Database, 
  Send, 
  Sparkles, 
  Calendar, 
  Search, 
  Filter, 
  UserPlus, 
  Briefcase, 
  CreditCard, 
  LineChart, 
  Percent, 
  BellRing, 
  Download,
  Award
} from "lucide-react";
import { MenuItem, Order, Table, Booking, Employee, InventoryItem, FinancialRecord, Customer } from "../types";

interface AdminPanelProps {
  state: {
    menuItems: MenuItem[];
    orders: Order[];
    tables: Table[];
    bookings: Booking[];
    employees: Employee[];
    inventory: InventoryItem[];
    financialRecords: FinancialRecord[];
    customers: Customer[];
    coupons: any[];
  };
  isLoading?: boolean;
  onUpdateOrderStatus: (orderId: string, status: string) => Promise<any>;
  onUpdateTableStatus: (tableId: string, status: string) => Promise<any>;
  onAddMenuItem: (itemData: any) => Promise<any>;
  onUpdateMenuItem: (id: string, itemData: any) => Promise<any>;
  onDeleteMenuItem: (id: string) => Promise<any>;
  onAddEmployee: (empData: any) => Promise<any>;
  onUpdateInventory: (id: string, invData: any) => Promise<any>;
}

const StatCardSkeleton = () => (
  <div className="bg-black border border-white/5 p-4 rounded-xl flex flex-col justify-between animate-pulse">
    <div className="flex justify-between items-start">
      <div className="h-3 bg-white/5 rounded w-16" />
      <div className="w-4 h-4 rounded-full bg-white/10" />
    </div>
    <div className="h-6 bg-white/10 rounded w-20 mt-4" />
  </div>
);

const GraphSkeleton = () => (
  <div className="lg:col-span-2 bg-zinc-950 border border-white/5 rounded-2xl p-6 space-y-6 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="space-y-2">
        <div className="h-4 bg-white/10 rounded w-32" />
        <div className="h-3 bg-white/5 rounded w-48" />
      </div>
      <div className="h-4 bg-emerald-500/10 rounded w-16" />
    </div>
    <div className="h-64 relative flex items-end gap-3 pb-8 pt-4">
      {[50, 85, 45, 95, 65, 115, 75, 135, 95, 150, 110, 140].map((h, i) => (
        <div 
          key={i} 
          className="flex-1 bg-white/5 rounded-t" 
          style={{ height: `${(h / 150) * 100}%`, opacity: 0.15 + (i / 15) }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent pointer-events-none" />
    </div>
  </div>
);

const AdminMenuSkeleton = () => (
  <div className="bg-zinc-950 border border-white/5 rounded-xl overflow-hidden flex flex-col justify-between animate-pulse h-[340px]">
    <div>
      <div className="h-44 bg-white/5 relative" />
      <div className="p-4 space-y-2">
        <div className="h-2.5 bg-white/5 rounded w-16" />
        <div className="h-4 bg-white/10 rounded w-2/3" />
        <div className="space-y-1.5 pt-1">
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-5/6" />
        </div>
      </div>
    </div>
    <div className="p-4 border-t border-white/5 flex gap-2 justify-end">
      <div className="h-8 w-16 bg-white/5 rounded" />
      <div className="h-8 w-16 bg-white/10 rounded" />
    </div>
  </div>
);

export default function AdminPanel({
  state,
  isLoading,
  onUpdateOrderStatus,
  onUpdateTableStatus,
  onAddMenuItem,
  onUpdateMenuItem,
  onDeleteMenuItem,
  onAddEmployee,
  onUpdateInventory
}: AdminPanelProps) {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('admin@opala.com');
  const [password, setPassword] = useState<string>('admin123');
  const [authError, setAuthError] = useState<string>('');

  // Navigation
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'pedidos' | 'mesas' | 'cardapio' | 'qrcodes' | 'funcionarios' | 'estoque' | 'financeiro' | 'crm' | 'marketing' | 'relatorios' | 'configuracoes'>('dashboard');

  // Interactive states
  const [orderFilter, setOrderFilter] = useState<string>('todos');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [menuSearch, setMenuSearch] = useState<string>('');
  
  // Table detail modal/drawer
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  // Add Item / Edit Item Form
  const [isMenuFormOpen, setIsMenuFormOpen] = useState<boolean>(false);
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItem | null>(null);
  const [menuForm, setMenuForm] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'principais' as any,
    image: '',
    ingredients: '',
    averageTime: 20,
    tags: [] as string[],
    calories: 450,
    protein: 20,
    carbs: 40,
    fat: 15,
    extras: [] as { name: string; price: number }[],
    sauces: [] as string[]
  });

  // QR Code Generation
  const [selectedQRTable, setSelectedQRTable] = useState<string>('08');
  const [qrSuccessMessage, setQrSuccessMessage] = useState<string>('');

  // Employee Form
  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState<boolean>(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    role: 'Garçom',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    shift: 'Noite (17:00 - 01:00)',
    phone: '',
    email: '',
    permissions: ['Visualizar Pedidos']
  });

  // Inventory adjustment
  const [adjustingInvItem, setAdjustingInvItem] = useState<InventoryItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(0);

  // AI Assistant Chat state
  const [aiChatMessages, setAiChatMessages] = useState<{ sender: 'user' | 'assistant'; text: string }[]>([
    { sender: 'assistant', text: 'Olá! Sou a Inteligência Analítica do Opala. Posso responder suas dúvidas sobre faturamento, pratos mais vendidos, sugestões operacionais de cupons ou insumos baixos no estoque. O que deseja saber hoje?' }
  ]);
  const [aiInput, setAiInput] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'admin@opala.com' && password === 'admin123') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Credenciais incorretas. Use admin@opala.com / admin123');
    }
  };

  // Status updates
  const handleStatusChange = async (orderId: string, status: string) => {
    await onUpdateOrderStatus(orderId, status);
  };

  // Save dish to Menu
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    const ingredientsArr = menuForm.ingredients.split(',').map(i => i.trim()).filter(Boolean);
    const itemPayload = {
      name: menuForm.name,
      description: menuForm.description,
      price: Number(menuForm.price),
      category: menuForm.category,
      image: menuForm.image || "https://images.unsplash.com/photo-1544025162-d76694265947?w=600",
      ingredients: ingredientsArr,
      averageTime: Number(menuForm.averageTime),
      tags: menuForm.tags as any[],
      nutritionalValue: {
        calories: Number(menuForm.calories),
        protein: Number(menuForm.protein),
        carbs: Number(menuForm.carbs),
        fat: Number(menuForm.fat)
      },
      extras: menuForm.extras,
      sauces: menuForm.sauces
    };

    if (editingMenuItem) {
      await onUpdateMenuItem(editingMenuItem.id, itemPayload);
    } else {
      await onAddMenuItem(itemPayload);
    }

    setIsMenuFormOpen(false);
    setEditingMenuItem(null);
    resetMenuForm();
  };

  const resetMenuForm = () => {
    setMenuForm({
      name: '',
      description: '',
      price: 0,
      category: 'principais',
      image: '',
      ingredients: '',
      averageTime: 20,
      tags: [],
      calories: 450,
      protein: 20,
      carbs: 40,
      fat: 15,
      extras: [],
      sauces: []
    });
  };

  // QR Code Print Simulation
  const handlePrintQR = () => {
    setQrSuccessMessage(`PDF do QR Code da Mesa ${selectedQRTable} gerado e enviado para a fila de impressão!`);
    setTimeout(() => setQrSuccessMessage(''), 4000);
  };

  // Employee creation
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddEmployee(employeeForm);
    setIsEmployeeFormOpen(false);
    setEmployeeForm({
      name: '',
      role: 'Garçom',
      photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      shift: 'Noite (17:00 - 01:00)',
      phone: '',
      email: '',
      permissions: ['Visualizar Pedidos']
    });
  };

  // Inventory Adjustments
  const handleSaveInventory = async () => {
    if (!adjustingInvItem) return;
    const newQty = adjustingInvItem.quantity + adjustQty;
    await onUpdateInventory(adjustingInvItem.id, { quantity: newQty });
    setAdjustingInvItem(null);
    setAdjustQty(0);
  };

  // AI Assistant Chat Logic (Queries server endpoint)
  const handleSendAiQuery = async (presetPrompt?: string) => {
    const promptToSend = presetPrompt || aiInput;
    if (!promptToSend.trim()) return;

    // Add user message to UI
    setAiChatMessages(prev => [...prev, { sender: 'user', text: promptToSend }]);
    setAiInput('');
    setIsAiLoading(true);

    try {
      const response = await fetch("/api/gemini/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptToSend }),
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          setAiChatMessages(prev => [...prev, { sender: 'assistant', text: data.response }]);
        } else {
          setAiChatMessages(prev => [...prev, { sender: 'assistant', text: "Erro ao comunicar com a IA do Opala (Resposta não-JSON do servidor). Por favor, tente novamente." }]);
        }
      } else {
        setAiChatMessages(prev => [...prev, { sender: 'assistant', text: "Erro ao comunicar com a IA do Opala. Por favor, tente novamente." }]);
      }
    } catch (err) {
      console.error(err);
      setAiChatMessages(prev => [...prev, { sender: 'assistant', text: "Erro ao comunicar com a IA do Opala. Por favor, tente novamente." }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Calculation statistics
  const revenueToday = state.financialRecords
    .filter(r => r.type === 'receita')
    .reduce((sum, r) => sum + r.amount, 0);

  const activeOrdersCount = state.orders.filter(o => o.status !== 'entregue' && o.status !== 'cancelado').length;
  const occupiedTablesCount = state.tables.filter(t => t.status === 'ocupada' || t.status === 'pagamento').length;
  const activeCustomersCount = state.customers.length;
  
  const ticketMedio = state.orders.length > 0 
    ? parseFloat((state.orders.reduce((sum, o) => sum + o.total, 0) / state.orders.length).toFixed(2))
    : 0;

  const totalExpense = state.financialRecords
    .filter(r => r.type === 'despesa')
    .reduce((sum, r) => sum + r.amount, 0);

  const profit = revenueToday - totalExpense;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 selection:bg-gold selection:text-black">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80" 
            alt="Opala Background" 
            className="w-full h-full object-cover opacity-15 filter blur-sm"
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-zinc-950/80 backdrop-blur-xl border border-white/10 p-8 md:p-12 rounded-3xl w-full max-w-md shadow-2xl space-y-8"
        >
          <div className="text-center space-y-2">
            <span className="text-3xl font-serif tracking-widest text-gold">OPALA</span>
            <h2 className="text-xl font-medium tracking-tight text-white">SaaS Control Panel</h2>
            <p className="text-xs text-gray-500 font-light">Efetue login para administrar as mesas, pedidos e estoque em tempo real.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">E-mail Corporativo</label>
              <input 
                id="login-email"
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">Senha Operacional</label>
              <input 
                id="login-password"
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors"
              />
            </div>

            {authError && (
              <p className="text-xs text-red-400 bg-red-400/10 border border-red-500/20 p-2.5 rounded-lg">{authError}</p>
            )}

            <button 
              id="btn-login-submit"
              type="submit"
              className="w-full bg-gold hover:bg-gold-hover text-black font-extrabold py-3.5 rounded-full transition-all tracking-widest text-[11px] uppercase shadow-lg shadow-gold/10"
            >
              Autenticar Acesso
            </button>
          </form>

          <div className="border-t border-white/5 pt-4 text-center text-[10px] text-gray-600">
            Acesso administrativo monitorado e criptografado.
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F2F2F2] flex flex-col md:flex-row font-sans">
      
      {/* Sidebar navigation */}
      <aside className="w-full md:w-64 bg-black border-r border-white/5 flex flex-col justify-between p-6 space-y-8 shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2.5 pb-4 border-b border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="leading-none">
              <span className="text-lg font-serif tracking-[0.2em] text-gold">OPALA</span>
              <p className="text-[9px] uppercase tracking-widest text-gray-500">SaaS Live Admin</p>
            </div>
          </div>

          <nav className="space-y-1 text-sm font-medium">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Grid },
              { id: 'pedidos', label: 'Pedidos Ativos', icon: ShoppingBag, badge: activeOrdersCount },
              { id: 'mesas', label: 'Gestão de Mesas', icon: Smartphone, badge: occupiedTablesCount },
              { id: 'cardapio', label: 'Gestão do Menu', icon: Layers },
              { id: 'qrcodes', label: 'Gerador QR Codes', icon: QrCode },
              { id: 'funcionarios', label: 'Funcionários', icon: Users },
              { id: 'estoque', label: 'Controle Estoque', icon: Database, alert: state.inventory.some(i => i.quantity <= i.minLimit) },
              { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
              { id: 'crm', label: 'CRM / Fidelidade', icon: Award },
              { id: 'marketing', label: 'Marketing / Cupons', icon: Percent },
              { id: 'relatorios', label: 'Relatórios', icon: FileText },
              { id: 'configuracoes', label: 'Configurações', icon: Settings }
            ].map(item => {
              const Icon = item.icon;
              return (
                <button 
                  id={`admin-menu-${item.id}`}
                  key={item.id}
                  onClick={() => setActiveMenu(item.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    activeMenu === item.id 
                      ? 'bg-gold/15 text-gold border-l-2 border-gold font-semibold' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-gold text-black text-[9px] font-bold px-2 py-0.5 rounded-full">{item.badge}</span>
                  )}
                  {item.alert && (
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-white/5 pt-4 space-y-2">
          <div className="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=100" alt="Admin user" className="w-10 h-10 rounded-full object-cover border border-white/10" />
            <div>
              <h5 className="text-xs font-semibold">Suporte Opala</h5>
              <span className="text-[10px] text-gray-500">tiagopw07@gmail.com</span>
            </div>
          </div>
          <button 
            id="btn-logout"
            onClick={() => setIsAuthenticated(false)}
            className="w-full text-center text-xs text-red-400 hover:underline pt-2"
          >
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main container area */}
      <main className="flex-1 p-6 md:p-10 max-h-screen overflow-y-auto space-y-8">
        
        {/* HEADER SECTION */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-2xl font-light text-white capitalize">Painel Administrativo &rsaquo; <span className="font-semibold text-gold font-serif">{activeMenu}</span></h1>
            <p className="text-xs text-gray-500 font-light pt-1">Gestão inteligente integrada • Restaurante Opala Ilha de Luanda</p>
          </div>
          <div className="flex items-center gap-3 text-xs bg-black border border-white/5 p-2 rounded-lg text-gray-400">
            <Clock className="w-4 h-4 text-gold" />
            <span>Último Sinc: {new Date().toLocaleTimeString()} (Operacional Ativo)</span>
          </div>
        </header>

        {/* ========================================================
            SUBVIEW: DASHBOARD
            ======================================================== */}
        {activeMenu === 'dashboard' && (
          <div id="subview-dashboard" className="space-y-8">
            {/* Real-time stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => <StatCardSkeleton key={idx} />)
              ) : (
                [
                  { label: 'Receita Hoje', val: `Kz ${revenueToday.toFixed(2)}`, icon: DollarSign, color: 'text-green-400' },
                  { label: 'Pedidos Ativos', val: activeOrdersCount, icon: ShoppingBag, color: 'text-gold' },
                  { label: 'Mesas Ocupadas', val: `${occupiedTablesCount} / 10`, icon: Smartphone, color: 'text-blue-400' },
                  { label: 'Clientes CRM', val: activeCustomersCount, icon: Users, color: 'text-purple-400' },
                  { label: 'Ticket Médio', val: `Kz ${ticketMedio.toFixed(2)}`, icon: TrendingUp, color: 'text-teal-400' },
                  { label: 'Lucro Previsto', val: `Kz ${profit.toFixed(2)}`, icon: LineChart, color: 'text-emerald-400' }
                ].map((stat, idx) => {
                  const Icon = stat.icon;
                  return (
                    <div key={idx} className="bg-black border border-white/5 p-4 rounded-xl flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</span>
                        <Icon className={`w-4 h-4 ${stat.color}`} />
                      </div>
                      <span className="text-lg font-medium text-white pt-3">{stat.val}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Analytics Graph */}
              {isLoading ? (
                <GraphSkeleton />
              ) : (
                <div className="lg:col-span-2 bg-zinc-950 border border-white/5 rounded-2xl p-6 space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Análise de Vendas Hoje</h3>
                      <p className="text-xs text-gray-500 font-light">Movimentação financeira por hora operacional</p>
                    </div>
                    <span className="text-xs text-emerald-400 font-bold tracking-wider uppercase">+14% vs ontem</span>
                  </div>

                  {/* Highly-engineered custom SVG Area Graph */}
                  <div className="h-64 relative">
                    <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#C5A059" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#C5A059" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid lines */}
                      <line x1="0" y1="50" x2="500" y2="50" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="4" />
                      <line x1="0" y1="100" x2="500" y2="100" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="4" />
                      <line x1="0" y1="150" x2="500" y2="150" stroke="#1f2937" strokeWidth="0.5" strokeDasharray="4" />

                      {/* Area path */}
                      <path 
                        d="M 10 180 L 80 140 L 150 155 L 220 90 L 290 110 L 360 40 L 430 75 L 500 20 L 500 200 L 10 200 Z" 
                        fill="url(#chartGrad)" 
                      />
                      {/* Line path */}
                      <path 
                        d="M 10 180 L 80 140 L 150 155 L 220 90 L 290 110 L 360 40 L 430 75 L 500 20" 
                        fill="none" 
                        stroke="#C5A059" 
                        strokeWidth="2.5" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex justify-between text-[9px] text-gray-500 pt-52">
                      <span>12:00h</span>
                      <span>14:00h</span>
                      <span>16:00h</span>
                      <span>18:00h</span>
                      <span>20:00h</span>
                      <span>22:00h</span>
                      <span>00:00h</span>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Quick Query Card */}
              <div className="bg-gradient-to-br from-zinc-950 via-zinc-950 to-amber-950/10 border border-white/10 rounded-2xl p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                    <h3 className="text-sm font-semibold text-white">Opala Inteligência Artificial</h3>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed font-light">
                    O assistente analítico lê em tempo real o faturamento, insumos no estoque e histórico CRM para formular promoções e previsões.
                  </p>

                  <div className="space-y-2 pt-2">
                    <button 
                      onClick={() => handleSendAiQuery("Quanto vendemos hoje e quais produtos comprar amanhã?")}
                      className="w-full text-left bg-black border border-white/5 hover:border-amber-500/30 p-2.5 rounded-lg text-xs text-amber-400 hover:text-white transition-all flex items-center justify-between"
                    >
                      <span>Quanto vendemos hoje?</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleSendAiQuery("Qual prato vende mais e qual prato possui melhor faturamento?")}
                      className="w-full text-left bg-black border border-white/5 hover:border-amber-500/30 p-2.5 rounded-lg text-xs text-amber-400 hover:text-white transition-all flex items-center justify-between"
                    >
                      <span>Qual prato vende mais?</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => handleSendAiQuery("Crie uma promoção exclusiva baseada no CRM para aumentar as vendas.")}
                      className="w-full text-left bg-black border border-white/5 hover:border-amber-500/30 p-2.5 rounded-lg text-xs text-amber-400 hover:text-white transition-all flex items-center justify-between"
                    >
                      <span>Criar cupom de marketing IA</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Perguntar ao Opala IA..." 
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendAiQuery()}
                    className="flex-1 bg-black border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                  <button 
                    onClick={() => handleSendAiQuery()}
                    className="bg-amber-500 hover:bg-amber-600 text-black px-3 rounded-lg flex items-center justify-center transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* AI Response Output Block if populated */}
            {aiChatMessages.length > 1 && (
              <div id="ai-response-box" className="bg-zinc-950 border border-amber-500/20 p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">Resposta Inteligência Artificial Opala</span>
                  </div>
                  <button 
                    onClick={() => setAiChatMessages([aiChatMessages[0]])}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    Limpar chat
                  </button>
                </div>
                <div className="text-sm font-light text-gray-200 leading-relaxed max-h-64 overflow-y-auto space-y-4">
                  {aiChatMessages.slice(1).map((msg, idx) => (
                    <div key={idx} className={`p-4 rounded-xl ${msg.sender === 'user' ? 'bg-zinc-900/40 text-right' : 'bg-black text-left'}`}>
                      <span className="text-[10px] uppercase font-bold text-amber-500 block mb-1">{msg.sender === 'user' ? 'Administrador' : 'Assistente Opala IA'}</span>
                      <p className="whitespace-pre-line">{msg.text}</p>
                    </div>
                  ))}
                  {isAiLoading && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Processando análise com Gemini...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            SUBVIEW: PEDIDOS ATIVOS
            ======================================================== */}
        {activeMenu === 'pedidos' && (
          <div id="subview-pedidos" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* Filters */}
              <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto">
                {['todos', 'recebido', 'preparando', 'pronto', 'entregue', 'cancelado'].map(st => (
                  <button 
                    key={st}
                    onClick={() => setOrderFilter(st)}
                    className={`px-4 py-2 rounded-lg text-xs uppercase tracking-wider border whitespace-nowrap transition-all ${
                      orderFilter === st 
                        ? 'bg-amber-500 text-black border-amber-500 font-semibold' 
                        : 'bg-zinc-950 text-gray-400 border-white/5 hover:border-white/10'
                    }`}
                  >
                    {st === 'todos' ? 'Todos os Pedidos' : st}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Pesquisar pedido..." 
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="space-y-4">
              {state.orders
                .filter(o => {
                  const matchesFilter = orderFilter === 'todos' || o.status === orderFilter;
                  const matchesSearch = o.id.toLowerCase().includes(orderSearch.toLowerCase()) || 
                                       (o.customerName && o.customerName.toLowerCase().includes(orderSearch.toLowerCase()));
                  return matchesFilter && matchesSearch;
                })
                .map(order => (
                  <div key={order.id} className="bg-zinc-950 border border-white/5 rounded-xl p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-semibold">{order.id}</span>
                          <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                            order.status === 'recebido' ? 'bg-blue-500/10 text-blue-400' :
                            order.status === 'preparando' ? 'bg-amber-500/10 text-amber-400 animate-pulse' :
                            order.status === 'pronto' ? 'bg-green-500/10 text-green-400' :
                            order.status === 'entregue' ? 'bg-zinc-800 text-zinc-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">Cliente: {order.customerName || `Mesa ${order.tableId}`} • Mesa: {order.tableId || "Delivery"}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-sm text-amber-500 font-semibold block">Total: Kz {order.total.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-500">{new Date(order.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {/* Order items details */}
                    <div className="space-y-2 text-xs">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-gray-300">
                          <span>{item.quantity} x {item.menuItem.name} {item.selectedSauce && `(${item.selectedSauce})`}</span>
                          {item.notes && <span className="text-gray-500 italic">"Obs: {item.notes}"</span>}
                        </div>
                      ))}
                    </div>

                    {/* Order controls */}
                    <div className="flex flex-wrap gap-2 pt-2 justify-end border-t border-white/5">
                      {order.status === 'recebido' && (
                        <button 
                          onClick={() => handleStatusChange(order.id, 'preparando')}
                          className="bg-amber-500 text-black text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
                        >
                          Aceitar & Preparar
                        </button>
                      )}
                      {order.status === 'preparando' && (
                        <button 
                          onClick={() => handleStatusChange(order.id, 'pronto')}
                          className="bg-emerald-500 text-black text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors"
                        >
                          Marcar como Pronto
                        </button>
                      )}
                      {order.status === 'pronto' && (
                        <button 
                          onClick={() => handleStatusChange(order.id, 'entregue')}
                          className="bg-zinc-800 text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                          Entregar Pedido
                        </button>
                      )}
                      {order.status !== 'entregue' && order.status !== 'cancelado' && (
                        <button 
                          onClick={() => handleStatusChange(order.id, 'cancelado')}
                          className="text-red-400 hover:bg-red-400/10 text-xs px-3 py-1.5 rounded-lg transition-all"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: GESTÃO DE MESAS
            ======================================================== */}
        {activeMenu === 'mesas' && (
          <div id="subview-mesas" className="grid md:grid-cols-3 gap-8">
            {/* Left Col: Interactive Grid */}
            <div className="md:col-span-2 space-y-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Mapa Visual de Mesas</h3>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {state.tables.map(table => (
                  <button 
                    id={`table-map-btn-${table.id}`}
                    key={table.id}
                    onClick={() => setSelectedTable(table)}
                    className={`border p-6 rounded-xl text-center space-y-3 transition-all flex flex-col justify-between h-40 ${
                      selectedTable?.id === table.id ? 'ring-2 ring-amber-500' : ''
                    } ${
                      table.status === 'livre' ? 'bg-zinc-950 border-emerald-500/20 text-emerald-400' :
                      table.status === 'ocupada' ? 'bg-zinc-950 border-red-500/20 text-red-400' :
                      table.status === 'reservada' ? 'bg-zinc-950 border-amber-500/20 text-amber-400' :
                      'bg-zinc-950 border-blue-500/20 text-blue-400'
                    }`}
                  >
                    <span className="text-xs uppercase tracking-widest text-gray-500">Mesa {table.id}</span>
                    <Smartphone className="w-8 h-8 mx-auto" />
                    <div>
                      <span className="text-xs font-bold uppercase block">{table.status}</span>
                      <span className="text-[10px] text-gray-500">{table.capacity} pessoas</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Col: Table detail sidebar */}
            <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 h-fit space-y-6">
              {selectedTable ? (
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-white/5 pb-4">
                    <h3 className="text-base font-semibold text-white">Mesa {selectedTable.id}</h3>
                    <span className="text-xs font-bold uppercase text-amber-500">{selectedTable.status}</span>
                  </div>

                  <div className="space-y-4 text-xs font-light">
                    <div className="flex justify-between text-gray-400">
                      <span>Capacidade total</span>
                      <span className="text-white font-medium">{selectedTable.capacity} pessoas</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Garçom Associado</span>
                      <span className="text-white font-medium">{selectedTable.waiterName || "Nenhum no momento"}</span>
                    </div>
                    {selectedTable.activeOrderId && (
                      <div className="flex justify-between text-gray-400">
                        <span>ID do Pedido Ativo</span>
                        <span className="text-white font-mono">{selectedTable.activeOrderId}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block mb-2">Alterar Estado da Mesa</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button 
                        onClick={() => { onUpdateTableStatus(selectedTable.id, 'livre'); setSelectedTable({ ...selectedTable, status: 'livre' }); }}
                        className="bg-black hover:bg-zinc-900 border border-emerald-500/20 text-emerald-400 py-2 rounded-lg"
                      >
                        Desocupar (Livre)
                      </button>
                      <button 
                        onClick={() => { onUpdateTableStatus(selectedTable.id, 'ocupada'); setSelectedTable({ ...selectedTable, status: 'ocupada' }); }}
                        className="bg-black hover:bg-zinc-900 border border-red-500/20 text-red-400 py-2 rounded-lg"
                      >
                        Ocupar (Ocupada)
                      </button>
                      <button 
                        onClick={() => { onUpdateTableStatus(selectedTable.id, 'reservada'); setSelectedTable({ ...selectedTable, status: 'reservada' }); }}
                        className="bg-black hover:bg-zinc-900 border border-amber-500/20 text-amber-400 py-2 rounded-lg"
                      >
                        Reservar (Reservada)
                      </button>
                      <button 
                        onClick={() => { onUpdateTableStatus(selectedTable.id, 'pagamento'); setSelectedTable({ ...selectedTable, status: 'pagamento' }); }}
                        className="bg-black hover:bg-zinc-900 border border-blue-500/20 text-blue-400 py-2 rounded-lg"
                      >
                        Pediu Conta
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <Smartphone className="w-12 h-12 text-zinc-800 mx-auto" />
                  <h4 className="text-sm font-semibold text-gray-400">Nenhuma mesa selecionada</h4>
                  <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                    Clique em qualquer bloco de mesa à esquerda para gerenciar o estado físico, pedidos vinculados e atribuir garçons líderes de salão.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: CARDAPIO
            ======================================================== */}
        {activeMenu === 'cardapio' && (
          <div id="subview-cardapio" className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <button 
                id="btn-add-dish"
                onClick={() => { resetMenuForm(); setEditingMenuItem(null); setIsMenuFormOpen(true); }}
                className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5 self-start"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Prato</span>
              </button>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Pesquisar prato..." 
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Menu items Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, idx) => <AdminMenuSkeleton key={idx} />)
              ) : (
                state.menuItems
                  .filter(item => item.name.toLowerCase().includes(menuSearch.toLowerCase()))
                  .map(item => (
                    <div key={item.id} className="bg-zinc-950 border border-white/5 rounded-xl overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="h-44 overflow-hidden relative">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          <span className="absolute top-3 right-3 bg-black/60 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase border border-white/10">Kz {item.price.toFixed(2)}</span>
                        </div>
                        <div className="p-4 space-y-2">
                          <span className="text-[9px] uppercase tracking-widest text-amber-400 font-bold block">{item.category}</span>
                          <h4 className="text-sm font-semibold">{item.name}</h4>
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{item.description}</p>
                        </div>
                      </div>

                      <div className="p-4 border-t border-white/5 flex gap-2 justify-end">
                        <button 
                          onClick={() => {
                            setEditingMenuItem(item);
                            setMenuForm({
                              name: item.name,
                              description: item.description,
                              price: item.price,
                              category: item.category,
                              image: item.image,
                              ingredients: item.ingredients.join(', '),
                              averageTime: item.averageTime,
                              tags: item.tags as any[],
                              calories: item.nutritionalValue.calories,
                              protein: item.nutritionalValue.protein,
                              carbs: item.nutritionalValue.carbs,
                              fat: item.nutritionalValue.fat,
                              extras: item.extras,
                              sauces: item.sauces
                            });
                            setIsMenuFormOpen(true);
                          }}
                          className="text-gray-400 hover:text-white p-2"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteMenuItem(item.id)}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Add / Edit Form Modal */}
            <AnimatePresence>
              {isMenuFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsMenuFormOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto z-10 space-y-6"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-4">
                      <h3 className="text-base font-semibold">{editingMenuItem ? 'Editar Prato' : 'Cadastrar Prato no Cardápio'}</h3>
                      <button onClick={() => setIsMenuFormOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
                    </div>

                    <form onSubmit={handleSaveMenu} className="space-y-4 text-xs font-medium">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase tracking-widest text-[9px]">Nome do Prato</label>
                          <input required type="text" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase tracking-widest text-[9px]">Preço (R$)</label>
                          <input required type="number" step="0.01" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500" />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase tracking-widest text-[9px]">Categoria</label>
                          <select value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value as any })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500">
                            <option value="entradas">Entradas</option>
                            <option value="principais">Pratos Principais</option>
                            <option value="massas">Massas</option>
                            <option value="carnes">Carnes</option>
                            <option value="peixes">Peixes</option>
                            <option value="sobremesas">Sobremesas</option>
                            <option value="bebidas">Bebidas</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase tracking-widest text-[9px]">Imagem (URL)</label>
                          <input type="text" placeholder="https://..." value={menuForm.image} onChange={(e) => setMenuForm({ ...menuForm, image: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500" />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-gray-400 uppercase tracking-widest text-[9px]">Descrição Completa</label>
                        <textarea required rows={2} value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 resize-none" />
                      </div>

                      <div className="space-y-1">
                        <label className="text-gray-400 uppercase tracking-widest text-[9px]">Ingredientes (Separados por vírgula)</label>
                        <input required type="text" placeholder="Ingrediente A, Ingrediente B..." value={menuForm.ingredients} onChange={(e) => setMenuForm({ ...menuForm, ingredients: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500" />
                      </div>

                      <div className="grid md:grid-cols-4 gap-4 pt-2 border-t border-white/5">
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase text-[9px]">Calorias</label>
                          <input type="number" value={menuForm.calories} onChange={(e) => setMenuForm({ ...menuForm, calories: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-white" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase text-[9px]">Proteínas</label>
                          <input type="number" value={menuForm.protein} onChange={(e) => setMenuForm({ ...menuForm, protein: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-white" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase text-[9px]">Carboidratos</label>
                          <input type="number" value={menuForm.carbs} onChange={(e) => setMenuForm({ ...menuForm, carbs: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-white" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-gray-400 uppercase text-[9px]">Gorduras</label>
                          <input type="number" value={menuForm.fat} onChange={(e) => setMenuForm({ ...menuForm, fat: Number(e.target.value) })} className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-white" />
                        </div>
                      </div>

                      <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3.5 rounded-lg text-xs uppercase tracking-wider">
                        Salvar prato
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: QR CODES GENERATOR
            ======================================================== */}
        {activeMenu === 'qrcodes' && (
          <div id="subview-qrcodes" className="max-w-4xl mx-auto bg-zinc-950 border border-white/5 rounded-2xl p-8 space-y-8">
            <div className="text-center max-w-lg mx-auto space-y-2">
              <span className="text-amber-500 text-xs tracking-widest uppercase font-bold block">QR Code Hub</span>
              <h3 className="text-xl font-medium">Gerador Instantâneo de Atendimento por Mesa</h3>
              <p className="text-xs text-gray-500 leading-relaxed font-light">
                Gere e exporte em alta resolução os adesivos QR code que conectam instantaneamente os smartphones dos clientes à nossa plataforma operacional sem necessidade de cadastro.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Controls */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400">Selecionar Mesa Operacional</label>
                  <select 
                    value={selectedQRTable}
                    onChange={(e) => setSelectedQRTable(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '15', '20'].map(num => (
                      <option key={num} value={num}>Mesa {num}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-gray-400">Tipo de Experiência</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-black border border-white/5 p-3 rounded-lg text-xs">
                      <Check className="w-4 h-4 text-amber-500" />
                      <span>Associação automática de pedido na mesa</span>
                    </div>
                    <div className="flex items-center gap-3 bg-black border border-white/5 p-3 rounded-lg text-xs">
                      <Check className="w-4 h-4 text-amber-500" />
                      <span>Chamada de garçom em tempo real habilitada</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={handlePrintQR}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3.5 rounded-lg text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>

                {qrSuccessMessage && (
                  <p className="text-xs text-green-400 bg-green-400/10 border border-green-500/20 p-3 rounded-lg text-center font-medium animate-pulse">{qrSuccessMessage}</p>
                )}
              </div>

              {/* Live Mock QR sticker Card */}
              <div className="bg-black border border-white/10 p-8 rounded-2xl text-center space-y-6 max-w-sm mx-auto shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
                <span className="text-[10px] tracking-widest uppercase font-bold text-amber-500">MESA IDENTIFICADA</span>
                
                <div className="w-48 h-48 bg-white p-3 rounded-lg mx-auto flex items-center justify-center">
                  {/* Styled visually high-fidelity QR Code simulation */}
                  <div className="relative w-full h-full bg-zinc-950 p-2 rounded flex flex-col justify-between overflow-hidden">
                    <div className="flex justify-between">
                      <span className="w-6 h-6 border-4 border-amber-500 bg-transparent block" />
                      <span className="w-6 h-6 border-4 border-amber-500 bg-transparent block" />
                    </div>
                    <div className="text-[10px] text-amber-500 font-bold font-mono py-2">STQR-{selectedQRTable}-OP</div>
                    <div className="flex justify-between items-end">
                      <span className="w-6 h-6 border-4 border-amber-500 bg-transparent block" />
                      <span className="w-8 h-8 rounded bg-amber-500 flex items-center justify-center text-black font-extrabold text-[10px]">{selectedQRTable}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-semibold tracking-wide">Mesa {selectedQRTable}</h4>
                  <p className="text-[10px] text-gray-500">Acesse: opala.com/menu?mesa={selectedQRTable}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: FUNCIONÁRIOS
            ======================================================== */}
        {activeMenu === 'funcionarios' && (
          <div id="subview-funcionarios" className="space-y-6">
            <button 
              id="btn-add-employee"
              onClick={() => setIsEmployeeFormOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-black text-xs font-semibold px-4 py-2.5 rounded-lg flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Funcionário</span>
            </button>

            {/* Employee grid list */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {state.employees.map(emp => (
                <div key={emp.id} className="bg-zinc-950 border border-white/5 p-6 rounded-xl flex items-start gap-4 justify-between">
                  <div className="flex gap-4">
                    <img src={emp.photo} alt={emp.name} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold">{emp.name}</h4>
                      <p className="text-xs text-amber-400">{emp.role}</p>
                      <p className="text-[10px] text-gray-500">Turno: {emp.shift}</p>
                      <p className="text-[10px] text-gray-500">Contato: {emp.phone}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Employee form Modal */}
            <AnimatePresence>
              {isEmployeeFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsEmployeeFormOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-md z-10 space-y-6"
                  >
                    <div className="flex justify-between items-center border-b border-white/5 pb-4">
                      <h3 className="text-base font-semibold">Adicionar Colaborador</h3>
                      <button onClick={() => setIsEmployeeFormOpen(false)}><X className="w-5 h-5 text-gray-500" /></button>
                    </div>

                    <form onSubmit={handleCreateEmployee} className="space-y-4 text-xs font-medium">
                      <div className="space-y-1">
                        <label className="text-gray-400">Nome Completo</label>
                        <input required type="text" value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400">Cargo / Função</label>
                        <input required type="text" value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-gray-400">Turno Operacional</label>
                        <input required type="text" value={employeeForm.shift} onChange={(e) => setEmployeeForm({ ...employeeForm, shift: e.target.value })} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white" />
                      </div>
                      <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-lg text-xs uppercase tracking-wider">
                        Cadastrar Funcionário
                      </button>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: ESTOQUE
            ======================================================== */}
        {activeMenu === 'estoque' && (
          <div id="subview-estoque" className="space-y-6">
            
            {/* Warning list */}
            {state.inventory.filter(i => i.quantity <= i.minLimit).map(item => (
              <div key={item.id} className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3 text-xs">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span><strong>ALERTA DE ESTOQUE BAIXO:</strong> O item <strong>{item.name}</strong> atingiu {item.quantity} {item.unit}. Limite mínimo de segurança estabelecido: {item.minLimit} {item.unit}. Compre amanhã!</span>
              </div>
            ))}

            {/* Inventory Table */}
            <div className="bg-zinc-950 border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-light">
                <thead className="bg-black border-b border-white/5 text-[10px] uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="p-4">Item de Estoque</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Qtd Atual</th>
                    <th className="p-4">Unidade</th>
                    <th className="p-4">Mínimo Crítico</th>
                    <th className="p-4">Última Atualização</th>
                    <th className="p-4 text-right">Ajustar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {state.inventory.map(item => (
                    <tr key={item.id} className={item.quantity <= item.minLimit ? 'bg-red-500/5' : ''}>
                      <td className="p-4 font-medium text-white">{item.name}</td>
                      <td className="p-4 text-gray-400">{item.category}</td>
                      <td className={`p-4 font-semibold ${item.quantity <= item.minLimit ? 'text-red-400' : 'text-emerald-400'}`}>{item.quantity}</td>
                      <td className="p-4 text-gray-400">{item.unit}</td>
                      <td className="p-4 text-gray-400">{item.minLimit}</td>
                      <td className="p-4 text-gray-500">{new Date(item.lastUpdated).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => { setAdjustingInvItem(item); setAdjustQty(0); }}
                          className="bg-zinc-900 hover:bg-zinc-800 border border-white/10 px-2.5 py-1 rounded text-[10px] text-amber-500"
                        >
                          Lançar Entrada
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Adjust stock Modal */}
            <AnimatePresence>
              {adjustingInvItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setAdjustingInvItem(null)} />
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative bg-zinc-950 border border-white/10 rounded-2xl p-6 w-full max-w-sm z-10 space-y-4"
                  >
                    <h3 className="text-sm font-semibold">Lançar Entrada de Insumo</h3>
                    <p className="text-xs text-gray-400">Inserindo abastecimento para <strong>{adjustingInvItem.name}</strong></p>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase text-gray-500">Quantidade a somar</label>
                      <input 
                        type="number" 
                        value={adjustQty} 
                        onChange={(e) => setAdjustQty(Number(e.target.value))}
                        className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm text-white" 
                      />
                    </div>

                    <button 
                      onClick={handleSaveInventory}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-black py-2 rounded-lg text-xs uppercase tracking-wider font-semibold"
                    >
                      Confirmar Entrada
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: FINANCEIRO
            ======================================================== */}
        {activeMenu === 'financeiro' && (
          <div id="subview-financeiro" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-zinc-950 border border-white/5 p-6 rounded-xl space-y-2">
                <span className="text-[10px] uppercase text-gray-500">Receitas Hoje</span>
                <h4 className="text-2xl font-semibold text-green-400">Kz {revenueToday.toFixed(2)}</h4>
              </div>
              <div className="bg-zinc-950 border border-white/5 p-6 rounded-xl space-y-2">
                <span className="text-[10px] uppercase text-gray-500">Despesas Lançadas</span>
                <h4 className="text-2xl font-semibold text-red-400">Kz {totalExpense.toFixed(2)}</h4>
              </div>
              <div className="bg-zinc-950 border border-white/5 p-6 rounded-xl space-y-2">
                <span className="text-[10px] uppercase text-gray-500">Fluxo de Caixa Líquido</span>
                <h4 className={`text-2xl font-semibold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>Kz {profit.toFixed(2)}</h4>
              </div>
            </div>

            {/* Financial Ledger */}
            <div className="bg-zinc-950 border border-white/5 rounded-xl overflow-hidden">
              <div className="p-4 bg-black border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-semibold">Livro Razão / Movimentações de Hoje</span>
                <button 
                  onClick={() => alert("Excel exportado com sucesso!")}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white text-[10px] px-3 py-1 rounded"
                >
                  Exportar Livro Razão (Excel/PDF)
                </button>
              </div>
              <table className="w-full text-left text-xs font-light">
                <thead className="bg-black text-[10px] uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="p-4">Histórico / Descrição</th>
                    <th className="p-4">Categoria</th>
                    <th className="p-4">Data/Hora</th>
                    <th className="p-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {state.financialRecords.map(rec => (
                    <tr key={rec.id}>
                      <td className="p-4 font-medium text-white">{rec.description}</td>
                      <td className="p-4 text-gray-400">{rec.category}</td>
                      <td className="p-4 text-gray-500">{new Date(rec.date).toLocaleTimeString()}</td>
                      <td className={`p-4 text-right font-semibold ${rec.type === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                        {rec.type === 'receita' ? '+' : '-'} Kz {rec.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: CRM
            ======================================================== */}
        {activeMenu === 'crm' && (
          <div id="subview-crm" className="space-y-6">
            <div className="bg-zinc-950 border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs font-light">
                <thead className="bg-black border-b border-white/5 text-[10px] uppercase text-gray-500 font-bold">
                  <tr>
                    <th className="p-4">Cliente VIP</th>
                    <th className="p-4">E-mail</th>
                    <th className="p-4">Telefone</th>
                    <th className="p-4">Visitas Hoje / Totais</th>
                    <th className="p-4">Gasto Acumulado</th>
                    <th className="p-4">Prato Favorito</th>
                    <th className="p-4">Fidelidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {state.customers.map(cust => (
                    <tr key={cust.id}>
                      <td className="p-4 font-semibold text-white">{cust.name}</td>
                      <td className="p-4 text-gray-400">{cust.email}</td>
                      <td className="p-4 text-gray-400">{cust.phone}</td>
                      <td className="p-4 text-gray-400">{cust.visits} visitas</td>
                      <td className="p-4 text-amber-500 font-bold">Kz {cust.totalSpent.toFixed(2)}</td>
                      <td className="p-4 text-gray-400 italic">{cust.favoriteDish}</td>
                      <td className="p-4">
                        <span className="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-bold text-[10px] border border-amber-500/30">
                          {cust.loyaltyPoints} pts
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: MARKETING
            ======================================================== */}
        {activeMenu === 'marketing' && (
          <div id="subview-marketing" className="grid md:grid-cols-2 gap-8">
            {/* Coupon and Promo lists */}
            <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 space-y-6">
              <h3 className="text-sm font-semibold uppercase text-gray-400">Cupons de Desconto Ativos</h3>
              <div className="space-y-3">
                {state.coupons.map(coupon => (
                  <div key={coupon.code} className="bg-black border border-white/5 p-4 rounded-xl flex justify-between items-center">
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-amber-500 font-mono tracking-widest">{coupon.code}</span>
                      <p className="text-xs text-gray-500 font-light">
                        {coupon.type === 'percentage' ? `${coupon.discount}% de desconto` : `R$ ${coupon.discount},00 fixo de desconto`}
                      </p>
                    </div>
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-2.5 py-1 rounded-full font-bold border border-emerald-500/20">ATIVO</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Broadcast simulator */}
            <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-500 animate-bounce" />
                <h3 className="text-sm font-semibold">Disparo de Notificações em Massa</h3>
              </div>
              <p className="text-xs text-gray-400 font-light leading-relaxed">
                Envie transmissões promocionais automáticas via WhatsApp ou notificações Push para toda a base cadastrada no CRM Opala.
              </p>

              <div className="space-y-4 pt-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase text-gray-500 font-bold">Mensagem WhatsApp / Push</label>
                  <textarea 
                    rows={4} 
                    defaultValue="🍷 Noite do Vinho Opala! Jante hoje conosco e ganhe 15% de desconto no prato Filet Mignon Angus ao molho de vinho nobre. Utilize o cupom: OPALA10. Garanta sua reserva imediata."
                    className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>
                <button 
                  onClick={() => alert("Push e WhatsApp transmitidos para 42 contatos com sucesso!")}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 rounded-lg tracking-wider text-xs uppercase"
                >
                  Agendar Disparo de Transmissão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: RELATÓRIOS
            ======================================================== */}
        {activeMenu === 'relatorios' && (
          <div id="subview-relatorios" className="max-w-2xl mx-auto bg-zinc-950 border border-white/5 rounded-2xl p-8 text-center space-y-6">
            <FileText className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className="text-lg font-semibold">Gerador de Fechamento & Relatórios Consolidados</h3>
            <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed font-light">
              Gere relatórios completos de vendas filtrados por Garçom, Mesa, Prato mais vendido, Forma de Pagamento e faturamento de períodos específicos.
            </p>

            <div className="grid grid-cols-2 gap-4 text-xs font-semibold pt-4">
              <button 
                onClick={() => alert("Relatório de Fechamento de Caixa exportado!")}
                className="bg-black hover:bg-zinc-900 border border-white/10 p-4 rounded-xl text-amber-500 flex flex-col items-center gap-2"
              >
                <span>Exportar Fechamento de Hoje</span>
              </button>
              <button 
                onClick={() => alert("Demonstrativo DRE Completo exportado!")}
                className="bg-black hover:bg-zinc-900 border border-white/10 p-4 rounded-xl text-amber-500 flex flex-col items-center gap-2"
              >
                <span>Demonstrativo DRE Semanal</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            SUBVIEW: CONFIGURAÇÕES
            ======================================================== */}
        {activeMenu === 'configuracoes' && (
          <div id="subview-configuracoes" className="max-w-3xl mx-auto bg-zinc-950 border border-white/5 rounded-2xl p-8 space-y-6 text-xs font-medium">
            <h3 className="text-base font-semibold border-b border-white/5 pb-4">Parâmetros Operacionais do Restaurante</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-gray-400">Nome Oficial Fantasia</label>
                <input type="text" defaultValue="Restaurante Opala" className="w-full bg-black border border-white/10 rounded-lg p-3 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400">Taxa de Serviço (%)</label>
                <input type="number" defaultValue={10} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400">Telefone / WhatsApp Comercial</label>
                <input type="text" defaultValue="+244 923 888 888" className="w-full bg-black border border-white/10 rounded-lg p-3 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400">Cidade / Localidade Sede</label>
                <input type="text" defaultValue="Ilha de Luanda, Luanda" className="w-full bg-black border border-white/10 rounded-lg p-3 text-white" />
              </div>
            </div>

            <button 
              onClick={() => alert("Configurações atualizadas com sucesso!")}
              className="bg-amber-500 hover:bg-amber-600 text-black px-6 py-3 rounded-lg font-semibold uppercase tracking-wider text-[11px]"
            >
              Salvar Configurações
            </button>
          </div>
        )}

      </main>

    </div>
  );
}
