import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, ArrowLeftRight } from "lucide-react";
import CustomerPortal from "./components/CustomerPortal";
import AdminPanel from "./components/AdminPanel";
import AccountModal, { toSiteAccount, type AccountMode } from "./components/AccountModal";
import { menuItems as seedMenu } from "./data/menu";
import { MenuItem, Order, Table, Booking, Employee, InventoryItem, FinancialRecord, Customer, SiteAccount } from "./types";

export default function App() {
  // Navigation mode: customer facing portal vs restaurant admin dashboard
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>('customer');

  // Conta autenticada no site (cliente) ou no painel (administração)
  const [account, setAccount] = useState<SiteAccount | null>(null);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [accountMode, setAccountMode] = useState<AccountMode>('login');
  const isSiteAdmin = account?.kind === 'admin';

  const openAccount = (mode: AccountMode = 'login') => {
    setAccountMode(mode);
    setIsAccountOpen(true);
  };

  // O painel abre pelo botão (só para a conta de administração) ou por #admin
  const [adminLink, setAdminLink] = useState<boolean>(window.location.hash === '#admin');
  useEffect(() => {
    const onHash = () => setAdminLink(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Unified global state synced with the full-stack server
  const [globalState, setGlobalState] = useState<{
    menuItems: MenuItem[];
    orders: Order[];
    tables: Table[];
    bookings: Booking[];
    employees: Employee[];
    inventory: InventoryItem[];
    financialRecords: FinancialRecord[];
    customers: Customer[];
    coupons: any[];
  }>({
    menuItems: seedMenu, // cardápio oficial; funciona mesmo sem servidor (ex.: Vercel)
    orders: [],
    tables: [],
    bookings: [],
    employees: [],
    inventory: [],
    financialRecords: [],
    customers: [],
    coupons: []
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quem já está autenticado neste browser (sessão de cliente ou de admin)
  const loadAccount = async () => {
    try {
      const res = await fetch("/api/customer/me", { headers: { Accept: "application/json" } });
      if (!res.ok) return;
      const data = await res.json();
      if (data.admin) {
        setAccount(toSiteAccount({ kind: "admin", admin: data.admin }));
      } else if (data.customer) {
        setAccount(toSiteAccount({ kind: "customer", customer: data.customer }));
      } else {
        setAccount(null);
      }
    } catch (err) {
      console.error("Error loading session:", err);
    }
  };

  useEffect(() => {
    loadAccount();
  }, []);

  const handleAuthenticated = (next: SiteAccount) => {
    setAccount(next);
    if (next.kind === 'admin') {
      setAdminLink(true);
      setViewMode('admin');
    }
  };

  const handleLogout = async () => {
    await Promise.allSettled([
      fetch("/api/customer/logout", { method: "POST" }),
      fetch("/api/auth/logout", { method: "POST" }),
    ]);
    setAccount(null);
    setViewMode('customer');
    setAdminLink(window.location.hash === '#admin');
  };

  // Sync state from server on mount & poll every 3 seconds for real-time order tracking
  const fetchState = async () => {
    try {
      const res = await fetch("/api/state");
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setGlobalState(prev => ({ ...prev, ...data, menuItems: data.menuItems?.length ? data.menuItems : prev.menuItems }));
        } else {
          console.warn("Received non-JSON response from /api/state. The server might be booting up or restarting.");
        }
      }
    } catch (err) {
      console.error("Error fetching state:", err);
    } finally {
      // Small intentional delay to allow users to experience the premium skeleton transition smoothly
      setTimeout(() => {
        setIsLoading(false);
      }, 1200);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  // API Call wrappers
  const handlePlaceOrder = async (orderData: any) => {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const newOrder = await res.json();
          await fetchState();
          return newOrder;
        }
      }
    } catch (err) {
      console.error("Error placing order:", err);
    }
  };

  const handleMakeBooking = async (bookingData: any) => {
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData)
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const newBooking = await res.json();
          await fetchState();
          return newBooking;
        }
      }
    } catch (err) {
      console.error("Error creating booking:", err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error updating order status:", err);
    }
  };

  const handleUpdateTableStatus = async (tableId: string, status: string) => {
    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error updating table status:", err);
    }
  };

  const handleAddMenuItem = async (itemData: any) => {
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData)
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error adding menu item:", err);
    }
  };

  const handleUpdateMenuItem = async (id: string, itemData: any) => {
    try {
      const res = await fetch(`/api/menu/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData)
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error updating menu item:", err);
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    try {
      const res = await fetch(`/api/menu/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error deleting menu item:", err);
    }
  };

  const handleAddEmployee = async (empData: any) => {
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empData)
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error adding employee:", err);
    }
  };

  const handleUpdateInventory = async (id: string, invData: any) => {
    try {
      const res = await fetch(`/api/inventory/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invData)
      });
      if (res.ok) {
        await fetchState();
      }
    } catch (err) {
      console.error("Error updating inventory:", err);
    }
  };

  return (
    <div className="relative">
      
      {/* Floating View Switcher to toggle easily in the live demo */}
      {(adminLink || isSiteAdmin || viewMode === 'admin') && (
      <div className="fixed bottom-6 left-6 z-50">
        <button 
          id="btn-toggle-view"
          onClick={() => setViewMode(viewMode === 'customer' ? 'admin' : 'customer')}
          className="bg-zinc-950/90 hover:bg-black text-amber-500 hover:text-amber-400 border border-amber-500/30 p-3.5 rounded-full shadow-2xl flex items-center gap-2.5 transition-all text-xs tracking-wider font-semibold group backdrop-blur-md"
        >
          <ArrowLeftRight className="w-4 h-4 text-amber-500 group-hover:rotate-180 transition-transform duration-500" />
          <span>Alternar para {viewMode === 'customer' ? 'PAINEL SAAS (ADMIN)' : 'PORTAL CLIENTE'}</span>
        </button>
      </div>
      )}

      <main>
        {viewMode === 'customer' ? (
          <CustomerPortal 
            state={globalState} 
            isLoading={isLoading}
            onPlaceOrder={handlePlaceOrder}
            onMakeBooking={handleMakeBooking}
            account={account}
            onOpenAccount={openAccount}
            onLogout={handleLogout}
            onOpenAdminPanel={() => setViewMode('admin')}
          />
        ) : (
          <AdminPanel 
            state={globalState}
            isLoading={isLoading}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateTableStatus={handleUpdateTableStatus}
            onAddMenuItem={handleAddMenuItem}
            onUpdateMenuItem={handleUpdateMenuItem}
            onDeleteMenuItem={handleDeleteMenuItem}
            onAddEmployee={handleAddEmployee}
            onUpdateInventory={handleUpdateInventory}
          />
        )}
      </main>

      <AccountModal
        open={isAccountOpen}
        mode={accountMode}
        onClose={() => setIsAccountOpen(false)}
        onAuthenticated={handleAuthenticated}
        onSwitchMode={setAccountMode}
      />

    </div>
  );
}
