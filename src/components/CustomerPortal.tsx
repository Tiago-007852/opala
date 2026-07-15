import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Menu as MenuIcon, 
  X, 
  ShoppingBag, 
  Plus, 
  Minus, 
  MapPin, 
  Clock, 
  Phone, 
  Instagram, 
  Facebook, 
  Calendar, 
  Users, 
  Sparkles, 
  ArrowRight, 
  ChevronRight, 
  CheckCircle2, 
  ShieldCheck, 
  MessageSquare,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Award
} from "lucide-react";
import { MenuItem, CartItem, Order, Table, Booking } from "../types";

const MenuSkeleton = () => (
  <div className="bg-white/5 border border-white/5 rounded-3xl overflow-hidden flex flex-col justify-between h-[450px] animate-pulse">
    <div>
      {/* Image placeholder */}
      <div className="h-56 bg-white/5 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute top-4 left-4 flex gap-1.5">
          <div className="h-5 w-16 bg-white/10 rounded-full" />
          <div className="h-5 w-12 bg-white/10 rounded-full" />
        </div>
      </div>
      {/* Content */}
      <div className="p-6 space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div className="h-6 bg-white/10 rounded w-2/3" />
          <div className="h-6 bg-amber-500/10 rounded w-1/4" />
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3.5 bg-white/5 rounded w-full" />
          <div className="h-3.5 bg-white/5 rounded w-5/6" />
        </div>
      </div>
    </div>
    {/* Footer */}
    <div className="px-6 pb-6 pt-2 border-t border-white/5 flex justify-between items-center">
      <div className="h-3.5 w-24 bg-white/10 rounded" />
      <div className="h-8 w-24 bg-white/15 rounded-full" />
    </div>
  </div>
);

interface CustomerPortalProps {
  state: {
    menuItems: MenuItem[];
    orders: Order[];
    tables: Table[];
    bookings: Booking[];
  };
  isLoading?: boolean;
  onPlaceOrder: (orderData: any) => Promise<any>;
  onMakeBooking: (bookingData: any) => Promise<any>;
}

export default function CustomerPortal({ state, isLoading, onPlaceOrder, onMakeBooking }: CustomerPortalProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'booking' | 'gallery' | 'about'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedTag, setSelectedTag] = useState<string>('todos');
  
  // Product Detail Modal
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [productQty, setProductQty] = useState<number>(1);
  const [selectedExtras, setSelectedExtras] = useState<{ name: string; price: number }[]>([]);
  const [selectedSauce, setSelectedSauce] = useState<string>('');
  const [productNotes, setProductNotes] = useState<string>('');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cartNotes, setCartNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cartao' | 'transferência' | 'dinheiro' | 'online'>('cartao');
  const [customerName, setCustomerName] = useState<string>('');
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [couponMessage, setCouponMessage] = useState<string>('');

  // Table recognition
  const [tableId, setTableId] = useState<string | null>(null);

  // Active placed order tracker (for real-time acompanhamento)
  const [activePlacedOrder, setActivePlacedOrder] = useState<Order | null>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState<boolean>(false);

  // Booking Form State
  const [bookingForm, setBookingForm] = useState({
    name: '',
    phone: '',
    email: '',
    date: '',
    time: '',
    people: 2,
    notes: ''
  });
  const [bookingSuccess, setBookingSuccess] = useState<boolean>(false);

  // Parse table parameter from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mesa = params.get('mesa');
    if (mesa) {
      setTableId(mesa);
      // Greet table automatically and navigate to menu
      setActiveTab('menu');
    }
  }, []);

  // Update tracking order from global state changes in real-time
  useEffect(() => {
    if (activePlacedOrder) {
      const liveOrder = state.orders.find(o => o.id === activePlacedOrder.id);
      if (liveOrder) {
        setActivePlacedOrder(liveOrder);
      }
    }
  }, [state.orders, activePlacedOrder]);

  // Calculations
  const cartSubtotal = cart.reduce((sum, item) => {
    const extrasTotal = item.selectedExtras.reduce((s, ex) => s + ex.price, 0);
    return sum + (item.menuItem.price + extrasTotal) * item.quantity;
  }, 0);
  
  const cartTax = parseFloat((cartSubtotal * 0.1).toFixed(2));
  const cartDiscount = couponDiscount > 0 ? (appliedCoupon === 'VIPGOLD' ? 50 : parseFloat((cartSubtotal * (couponDiscount / 100)).toFixed(2))) : 0;
  const cartTotal = parseFloat((cartSubtotal + cartTax - cartDiscount).toFixed(2));

  const handleApplyCoupon = () => {
    const code = appliedCoupon.toUpperCase().trim();
    if (code === 'OPALA10') {
      setCouponDiscount(10);
      setCouponMessage('Cupom OPALA10 aplicado: 10% de desconto!');
    } else if (code === 'VIPGOLD' && cartSubtotal >= 300) {
      setCouponDiscount(50); // simulated fixed or huge percent
      setCouponMessage('Cupom VIPGOLD aplicado: R$ 50,00 de desconto!');
    } else if (code === 'BEMVINDO') {
      setCouponDiscount(15);
      setCouponMessage('Cupom BEMVINDO aplicado: 15% de desconto!');
    } else {
      setCouponDiscount(0);
      setCouponMessage('Cupom inválido ou valor mínimo não atingido.');
    }
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    const newItem: CartItem = {
      menuItem: selectedProduct,
      quantity: productQty,
      selectedExtras: [...selectedExtras],
      selectedSauce: selectedSauce,
      notes: productNotes
    };
    setCart([...cart, newItem]);
    
    // reset product modal states
    setSelectedProduct(null);
    setProductQty(1);
    setSelectedExtras([]);
    setSelectedSauce('');
    setProductNotes('');
  };

  const handleRemoveFromCart = (index: number) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const orderPayload = {
      tableId: tableId || "",
      items: cart,
      subtotal: cartSubtotal,
      tax: cartTax,
      discount: cartDiscount,
      total: cartTotal,
      paymentMethod: paymentMethod,
      status: "recebido",
      customerName: customerName || "Mesa " + (tableId || "Delivery"),
      notes: cartNotes
    };

    try {
      const placed = await onPlaceOrder(orderPayload);
      setActivePlacedOrder(placed);
      setCart([]);
      setIsCartOpen(false);
      setIsTrackingOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingForm.name || !bookingForm.phone || !bookingForm.date) return;
    try {
      await onMakeBooking(bookingForm);
      setBookingSuccess(true);
      setTimeout(() => {
        setBookingSuccess(false);
        setActiveTab('home');
        setBookingForm({
          name: '',
          phone: '',
          email: '',
          date: '',
          time: '',
          people: 2,
          notes: ''
        });
      }, 4000);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter Logic
  const filteredItems = state.menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'todos' || item.category === selectedCategory;
    const matchesTag = selectedTag === 'todos' || item.tags.includes(selectedTag as any);
    return matchesCategory && matchesTag;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F2F2F2] font-sans selection:bg-gold selection:text-black relative overflow-hidden">
      
      {/* Sleek Theme Ambient Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-gold opacity-5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-gold opacity-10 rounded-full blur-[100px]"></div>
      </div>

      {/* Table Welcome Banner */}
      {tableId && (
        <div id="table-banner" className="relative z-10 bg-gradient-to-r from-gold/10 via-gold/20 to-gold/10 border-b border-gold/30 py-3 px-4 text-center text-sm font-medium tracking-wide flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-gold animate-pulse" />
          <span>Atendimento digital ativo. Você está na <span className="text-gold font-bold underline">Mesa {tableId}</span>. Todos os pedidos serão associados à sua mesa.</span>
        </div>
      )}

      {/* Header / Nav */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/85 backdrop-blur-md border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center transition-all">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 border border-gold flex items-center justify-center rotate-45 shrink-0">
            <span className="-rotate-45 text-lg font-serif font-bold text-gold">O</span>
          </div>
          <span className="text-xl font-serif tracking-[0.2em] ml-1 text-white">OPALA</span>
          <span className="text-[9px] uppercase tracking-widest text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full hidden sm:inline ml-2">Premium</span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs uppercase tracking-[0.2em] font-medium text-white/60">
          <button 
            id="nav-home"
            onClick={() => setActiveTab('home')} 
            className={`hover:text-white transition-colors py-1 relative ${activeTab === 'home' ? 'text-white border-b border-gold' : ''}`}
          >
            HOME
          </button>
          <button 
            id="nav-menu"
            onClick={() => setActiveTab('menu')} 
            className={`hover:text-white transition-colors py-1 relative ${activeTab === 'menu' ? 'text-white border-b border-gold' : ''}`}
          >
            CARDÁPIO DIGITAL
          </button>
          <button 
            id="nav-booking"
            onClick={() => setActiveTab('booking')} 
            className={`hover:text-white transition-colors py-1 relative ${activeTab === 'booking' ? 'text-white border-b border-gold' : ''}`}
          >
            RESERVAS
          </button>
          <button 
            id="nav-gallery"
            onClick={() => setActiveTab('gallery')} 
            className={`hover:text-white transition-colors py-1 relative ${activeTab === 'gallery' ? 'text-white border-b border-gold' : ''}`}
          >
            AMBIENTE
          </button>
          <button 
            id="nav-about"
            onClick={() => setActiveTab('about')} 
            className={`hover:text-white transition-colors py-1 relative ${activeTab === 'about' ? 'text-white border-b border-gold' : ''}`}
          >
            HISTÓRIA
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {activePlacedOrder && (
            <button 
              id="btn-track-order"
              onClick={() => setIsTrackingOpen(true)}
              className="bg-gold/10 border border-gold/30 text-gold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-full flex items-center gap-1.5 hover:bg-gold/20 transition-all font-semibold"
            >
              <Clock className="w-3 h-3 animate-spin text-gold" />
              <span>Acompanhar Pedido</span>
            </button>
          )}

          <button 
            id="btn-cart"
            onClick={() => setIsCartOpen(true)}
            className="relative bg-white/5 hover:bg-white/10 p-2.5 rounded-full border border-white/10 hover:border-white/20 transition-all text-gold flex items-center justify-center"
          >
            <ShoppingBag className="w-5 h-5" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-gold text-black text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="pb-24">
        
        {/* TAB: HOME */}
        {activeTab === 'home' && (
          <div id="tab-home">
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex flex-col justify-center items-center px-6 text-center overflow-hidden">
              {/* Luxury Ambient Video/Image Background */}
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1600&auto=format&fit=crop&q=80" 
                  alt="Opala Restaurante" 
                  className="w-full h-full object-cover opacity-30 scale-105 filter brightness-75"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
              </div>

              {/* Foreground content with entry animation */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 max-w-4xl flex flex-col items-center"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-[1px] w-12 bg-gold"></div>
                  <span className="text-gold text-xs uppercase tracking-[0.4em] font-bold">Cozinha de Autor</span>
                  <div className="h-[1px] w-12 bg-gold"></div>
                </div>

                <h1 className="text-5xl md:text-7xl font-serif leading-[1.1] mb-6 text-white">
                  Gastronomia em <br/><span className="italic text-gold font-serif">Estado de Arte</span>
                </h1>
                
                <p className="text-base md:text-xl font-light text-white/60 tracking-wide max-w-2xl mb-12 leading-relaxed">
                  Uma jornada sensorial extraordinária, onde a tradição brasileira encontra a sofisticação internacional. Cada prato é uma joia lapidada para o seu paladar.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full max-w-md justify-center mb-16">
                  <button 
                    id="hero-menu"
                    onClick={() => setActiveTab('menu')}
                    className="flex-1 bg-gold hover:bg-gold-hover text-black font-bold py-4 px-8 rounded-full transition-all tracking-widest text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
                  >
                    Ver Cardápio
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    id="hero-booking"
                    onClick={() => setActiveTab('booking')}
                    className="flex-1 bg-white/5 backdrop-blur-md text-white border border-white/10 hover:border-white/20 hover:bg-white/10 font-bold py-4 px-8 rounded-full transition-all tracking-widest text-[11px] uppercase"
                  >
                    Fazer Reserva
                  </button>
                </div>

                {/* Stars feedback */}
                <div className="border-t border-white/10 pt-8 w-full max-w-lg">
                  <div className="text-gold text-sm tracking-wider mb-2">★★★★★</div>
                  <p className="text-[10px] tracking-widest text-white/50 uppercase">Mais de 5.000 clientes satisfeitos e fidelizados</p>
                </div>
              </motion.div>
            </section>

            {/* Featured Section */}
            <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
              <div className="grid md:grid-cols-2 gap-16 items-center">
                <div className="space-y-6">
                  <span className="text-gold text-xs uppercase tracking-[0.3em] font-semibold">Inigualável</span>
                  <h2 className="text-3xl md:text-5xl font-serif tracking-wide leading-tight">Onde a Tradição Encontra a Modernidade</h2>
                  <p className="text-white/50 leading-relaxed font-light text-base">
                    Localizado no coração da metrópole, o Restaurante Opala redefine a experiência culinária contemporânea. Nossos chefs de renome mundial selecionam meticulosamente insumos frescos e raros para criar pratos surpreendentes que unem técnicas clássicas e inovação molecular.
                  </p>
                  <div className="grid grid-cols-2 gap-6 pt-6">
                    <div className="border-l border-gold/40 pl-4">
                      <h4 className="text-2xl font-serif text-white">100%</h4>
                      <p className="text-[10px] text-white/50 uppercase tracking-widest">Insumos Orgânicos e Frescos</p>
                    </div>
                    <div className="border-l border-gold/40 pl-4">
                      <h4 className="text-2xl font-serif text-white">Michelin</h4>
                      <p className="text-[10px] text-white/50 uppercase tracking-widest">Padrão de Serviço Internacional</p>
                    </div>
                  </div>
                </div>
                <div className="relative h-[450px] rounded-2xl overflow-hidden border border-white/10 group">
                  <img 
                    src="https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&auto=format&fit=crop&q=80" 
                    alt="Prato do Chef" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6 p-6 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                    <span className="text-gold text-xs uppercase tracking-widest block mb-2 font-bold">Destaque de Hoje</span>
                    <h4 className="text-xl font-serif">Lagosta Cavaquinha na Manteiga de Sálvia</h4>
                    <button 
                      onClick={() => { setActiveTab('menu'); setSelectedCategory('massas'); }}
                      className="text-xs text-gold mt-2 flex items-center gap-1 hover:underline"
                    >
                      Pedir este prato <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Testimonials Carousel */}
            <section className="bg-gradient-to-b from-black to-[#0A0A0A] py-24 px-6 border-y border-white/5">
              <div className="max-w-4xl mx-auto text-center">
                <span className="text-gold text-xs tracking-widest uppercase font-semibold block mb-4">Depoimentos</span>
                <h3 className="text-3xl md:text-4xl font-serif tracking-wide mb-16">A Experiência de Quem nos Visita</h3>
                
                {/* Simulated slider */}
                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 md:p-12 relative overflow-hidden">
                  <div className="text-gold text-2xl mb-6">★★★★★</div>
                  <p className="text-lg md:text-xl text-white/80 italic font-serif font-light mb-8 leading-relaxed">
                    "O Opala não é apenas uma refeição, é um espetáculo. O atendimento do Gustavo foi impecável, as Vieiras com Trufas derretem na boca e a atmosfera do lugar nos transporta para Paris ou Milão. Voltaremos com certeza."
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-gold/30">
                      <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80" alt="Cliente" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-semibold text-white">Dr. Rodolfo Bento</h5>
                      <span className="text-[10px] text-white/40 uppercase tracking-widest">Advogado e Colecionador</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Contact & Map info */}
            <section className="py-24 px-6 max-w-7xl mx-auto grid md:grid-cols-3 gap-8">
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 space-y-4">
                <MapPin className="w-6 h-6 text-gold" />
                <h4 className="text-lg font-serif text-white">Localização</h4>
                <p className="text-white/60 text-sm font-light">Ilha de Luanda, Luanda, Angola</p>
              </div>
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 space-y-4">
                <Clock className="w-6 h-6 text-gold" />
                <h4 className="text-lg font-serif text-white">Horário de Funcionamento</h4>
                <p className="text-white/60 text-sm font-light leading-relaxed">Terça a Sábado: 19:00h às 00:00h<br />Domingo: 12:00h às 16:30h</p>
              </div>
              <div className="bg-white/5 backdrop-blur-md p-8 rounded-2xl border border-white/10 space-y-4">
                <Phone className="w-6 h-6 text-gold" />
                <h4 className="text-lg font-serif text-white">Reservas & Contato</h4>
                <p className="text-white/60 text-sm font-light leading-relaxed">Tel: +244 222 300 840<br />WhatsApp: +244 923 888 888</p>
              </div>
            </section>
          </div>
        )}

        {/* TAB: CARDÁPIO DIGITAL */}
        {activeTab === 'menu' && (
          <div id="tab-menu" className="px-6 md:px-12 max-w-7xl mx-auto pt-12 relative z-10">
            
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-gold text-xs uppercase tracking-[0.3em] font-semibold block mb-3">Menu Gastronômico</span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-wide mb-4">Escolha com Calma e Sofisticação</h2>
              <p className="text-white/50 font-light text-sm leading-relaxed">
                Toque nos pratos para abrir a ficha completa de ingredientes, valores nutricionais e personalizar seus molhos e acompanhamentos.
              </p>
            </div>

            {/* Categories scrollbar */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-thin scrollbar-thumb-zinc-800 border-b border-white/5">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'entradas', label: 'Entradas' },
                { id: 'principais', label: 'Pratos Principais' },
                { id: 'massas', label: 'Massas' },
                { id: 'carnes', label: 'Carnes' },
                { id: 'peixes', label: 'Peixes' },
                { id: 'sobremesas', label: 'Sobremesas' },
                { id: 'bebidas', label: 'Bebidas' }
              ].map(cat => (
                <button 
                  id={`cat-filter-${cat.id}`}
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-6 py-2.5 rounded-full text-[10px] font-bold tracking-widest uppercase whitespace-nowrap border transition-all ${
                    selectedCategory === cat.id 
                      ? 'bg-gold text-black border-gold' 
                      : 'bg-white/5 backdrop-blur-md hover:bg-white/10 text-white/70 border-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Tags / Badges selector */}
            <div className="flex flex-wrap gap-2 mb-12">
              {[
                { id: 'todos', label: 'Todos os Estilos' },
                { id: 'Novo', label: 'Novidades ✨' },
                { id: 'Mais vendido', label: 'Mais Vendidos 🔥' },
                { id: 'Vegano', label: 'Opções Veganas 🥗' },
                { id: 'Sem Glúten', label: 'Sem Glúten 🌾' },
                { id: 'Picante', label: 'Toque Picante 🌶️' }
              ].map(tag => (
                <button 
                  id={`tag-filter-${tag.id}`}
                  key={tag.id}
                  onClick={() => setSelectedTag(tag.id)}
                  className={`px-4 py-1.5 rounded-full text-[10px] uppercase font-semibold tracking-wider transition-all ${
                    selectedTag === tag.id
                      ? 'bg-gold/10 text-gold border border-gold/30'
                      : 'bg-transparent text-white/40 border border-white/5 hover:text-white/70 hover:border-white/10'
                  }`}
                >
                  {tag.label}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <MenuSkeleton key={i} />)
              ) : (
                filteredItems.map(item => (
                  <motion.div 
                    id={`menu-item-card-${item.id}`}
                    key={item.id}
                    onClick={() => setSelectedProduct(item)}
                    whileHover={{ y: -6 }}
                    className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-gold/30 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Image */}
                      <div className="h-56 overflow-hidden relative">
                        <img 
                          src={item.image} 
                          alt={item.name} 
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute top-4 left-4 flex gap-1.5 flex-wrap">
                          {item.tags.map(tag => (
                            <span key={tag} className="bg-gold text-black font-extrabold text-[9px] uppercase tracking-widest px-3 py-1 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Meta */}
                      <div className="p-6 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <h3 className="text-lg font-serif group-hover:text-gold transition-colors">{item.name}</h3>
                          <span className="text-gold font-serif font-medium whitespace-nowrap">Kz {item.price.toFixed(2)}</span>
                        </div>
                        <p className="text-sm text-white/50 font-light line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="px-6 pb-6 pt-2 flex justify-between items-center border-t border-white/5">
                      <span className="text-[9px] uppercase tracking-wider text-white/40">Preparo: {item.averageTime} min</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(item);
                        }}
                        className="text-[10px] text-gold font-bold tracking-widest uppercase flex items-center gap-1 hover:text-white"
                      >
                        Pedir Prato <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: RESERVAS */}
        {activeTab === 'booking' && (
          <div id="tab-booking" className="px-6 md:px-12 max-w-4xl mx-auto pt-12 relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-gold text-xs uppercase tracking-[0.3em] font-semibold block mb-3">Reservas Privadas</span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-wide mb-4">Garanta Sua Mesa Exclusiva</h2>
              <p className="text-white/50 font-light text-sm leading-relaxed">
                Planeje uma noite extraordinária de sabores no Restaurante Opala. A confirmação é instantânea e 100% automatizada.
              </p>
            </div>

            {bookingSuccess ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/5 backdrop-blur-md border border-gold/30 p-12 rounded-3xl text-center space-y-6"
              >
                <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto border border-gold/30">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-serif text-white">Sua Reserva foi Confirmada!</h3>
                <p className="text-white/60 max-w-md mx-auto leading-relaxed text-sm font-light">
                  Enviamos os detalhes e o código de confirmação para o seu e-mail e telefone cadastrados. Estaremos esperando você com uma atmosfera única.
                </p>
                <p className="text-xs text-gold uppercase tracking-widest font-extrabold">Até breve no Restaurante Opala</p>
              </motion.div>
            ) : (
              <form onSubmit={handleBookingSubmit} className="bg-white/5 backdrop-blur-md border border-white/5 rounded-3xl p-8 md:p-12 space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">Nome Completo</label>
                    <input 
                      id="booking-name"
                      type="text" 
                      required
                      placeholder="Ex: Alexandre Silva"
                      value={bookingForm.name}
                      onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">Telefone / WhatsApp</label>
                    <input 
                      id="booking-phone"
                      type="tel" 
                      required
                      placeholder="Ex: +244 923 456 789"
                      value={bookingForm.phone}
                      onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">Data do Jantar</label>
                    <input 
                      id="booking-date"
                      type="date" 
                      required
                      value={bookingForm.date}
                      onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">Horário</label>
                    <input 
                      id="booking-time"
                      type="time" 
                      required
                      value={bookingForm.time}
                      onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">Pessoas</label>
                    <div className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-xl py-2.5 px-3">
                      <button 
                        type="button"
                        onClick={() => setBookingForm({ ...bookingForm, people: Math.max(1, bookingForm.people - 1) })}
                        className="p-1 text-white/40 hover:text-white"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="flex-1 text-center font-semibold text-white">{bookingForm.people}</span>
                      <button 
                        type="button"
                        onClick={() => setBookingForm({ ...bookingForm, people: Math.min(20, bookingForm.people + 1) })}
                        className="p-1 text-white/40 hover:text-white"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">E-mail para Confirmação</label>
                  <input 
                    id="booking-email"
                    type="email" 
                    placeholder="seuemail@exemplo.com"
                    value={bookingForm.email}
                    onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold">Observações Especiais (Ex: Restrições alimentares, alergias, datas comemorativas)</label>
                  <textarea 
                    id="booking-notes"
                    rows={3}
                    placeholder="Insira detalhes que tornarão sua visita ainda melhor..."
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 px-4 text-sm text-white focus:outline-none focus:border-gold transition-colors resize-none"
                  />
                </div>

                <button 
                  id="booking-submit"
                  type="submit"
                  className="w-full bg-gold hover:bg-gold-hover text-black font-extrabold py-4 rounded-full transition-all tracking-widest text-[11px] uppercase shadow-lg shadow-gold/10"
                >
                  Solicitar Confirmação Automática
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB: GALLERY */}
        {activeTab === 'gallery' && (
          <div id="tab-gallery" className="px-6 md:px-12 max-w-7xl mx-auto pt-12 relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <span className="text-gold text-xs uppercase tracking-[0.3em] font-semibold block mb-3">Galeria Opala</span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-wide mb-4">Nossa Atmosfera Luxuosa</h2>
              <p className="text-white/50 font-light text-sm leading-relaxed">
                Uma fusão sutil de arquitetura moderna, iluminação cênica de baixa intensidade e arte contemporânea em cada detalhe.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { img: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600", tag: "Culinária" },
                { img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600", tag: "Salão Principal" },
                { img: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=600", tag: "Bar & Drinks" },
                { img: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600", tag: "Ambiente Externo" },
                { img: "https://images.unsplash.com/photo-1532636875304-0c8fe119ff91?w=600", tag: "Ingredientes Raros" },
                { img: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=600", tag: "Cozinha do Chef" }
              ].map((item, index) => (
                <div key={index} className="h-80 rounded-2xl overflow-hidden border border-white/5 relative group cursor-pointer">
                  <img 
                    src={item.img} 
                    alt={item.tag} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-60 group-hover:opacity-85 transition-opacity" />
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-gold/15 border border-gold/30 text-gold text-[10px] px-3.5 py-1.5 rounded-full tracking-widest uppercase font-bold">
                      {item.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: ABOUT */}
        {activeTab === 'about' && (
          <div id="tab-about" className="px-6 md:px-12 max-w-5xl mx-auto pt-12 space-y-16 relative z-10">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-gold text-xs uppercase tracking-[0.3em] font-semibold block mb-3">Nossa Origem</span>
              <h2 className="text-4xl md:text-5xl font-serif tracking-wide mb-4">A Lenda de Opala</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6 text-white/70 leading-relaxed font-light text-base">
                <p>
                  Fundado pelo conceituado sommelier e colecionador de gemas preciosas Eduardo Ndalu, o restaurante nasceu sob a premissa de que a culinária é uma gema em estado bruto, que atinge sua plenitude somente através da lapidação do tempo e da técnica impecável.
                </p>
                <p>
                  Batizado com o nome da pedra "Opala" — célebre por sua capacidade única de refletir um arco-íris de cores sob diferentes espectros de luz —, nosso cardápio busca esse mesmo efeito: refletir múltiplos horizontes de sabores a cada garfada.
                </p>
              </div>
              <div className="h-96 rounded-3xl overflow-hidden border border-white/10">
                <img 
                  src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&auto=format&fit=crop&q=80" 
                  alt="Eduardo Ndalu Chef" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 pt-12 border-t border-white/5">
              <div className="space-y-3 bg-white/5 border border-white/5 p-6 rounded-2xl">
                <h4 className="text-lg font-serif text-gold">Missão</h4>
                <p className="text-sm text-white/50 leading-relaxed font-light">
                  Lapidar ingredientes frescos em experiências gastronômicas exclusivas, gerando memórias memoráveis de elegância e sofisticação culinária.
                </p>
              </div>
              <div className="space-y-3 bg-white/5 border border-white/5 p-6 rounded-2xl">
                <h4 className="text-lg font-serif text-gold">Visão</h4>
                <p className="text-sm text-white/50 leading-relaxed font-light">
                  Ser reconhecido como o epicentro da vanguarda culinária em Angola, unindo hospitalidade impecável a criações autorais refinadas.
                </p>
              </div>
              <div className="space-y-3 bg-white/5 border border-white/5 p-6 rounded-2xl">
                <h4 className="text-lg font-serif text-gold">Valores</h4>
                <p className="text-sm text-white/50 leading-relaxed font-light">
                  Excelência absoluta em serviço, sustentabilidade na seleção orgânica de pequenos produtores rurais, e criatividade incessante na inovação.
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-black/80 border-t border-white/5 py-16 px-6 md:px-12 text-white/40 relative z-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-12 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 border border-gold flex items-center justify-center rotate-45 shrink-0">
                <span className="-rotate-45 text-sm font-serif font-bold text-gold">O</span>
              </div>
              <span className="text-lg font-serif tracking-[0.2em] ml-1 text-white">OPALA</span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed font-light">
              Uma nova dimensão culinária. Experiência refinada com pedido direto da mesa e acompanhamento real-time.
            </p>
            <div className="flex gap-4 pt-2">
              <a href="#" className="hover:text-white transition-colors"><Instagram className="w-4 h-4" /></a>
              <a href="#" className="hover:text-white transition-colors"><Facebook className="w-4 h-4" /></a>
              <a href="#" className="hover:text-white transition-colors"><Phone className="w-4 h-4" /></a>
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="text-white text-xs font-semibold uppercase tracking-widest">Acesso Rápido</h5>
            <ul className="space-y-2 text-sm font-light">
              <li><button onClick={() => setActiveTab('home')} className="hover:text-white transition-colors">Home</button></li>
              <li><button onClick={() => setActiveTab('menu')} className="hover:text-white transition-colors">Cardápio Digital</button></li>
              <li><button onClick={() => setActiveTab('booking')} className="hover:text-white transition-colors">Reservas</button></li>
              <li><button onClick={() => setActiveTab('gallery')} className="hover:text-white transition-colors">Ambiente</button></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="text-white text-xs font-semibold uppercase tracking-widest">Políticas</h5>
            <ul className="space-y-2 text-sm font-light">
              <li><a href="#" className="hover:text-white transition-colors">Política de Privacidade</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Termos de Uso</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Segurança Digital</a></li>
            </ul>
          </div>

          <div className="space-y-3">
            <h5 className="text-white text-xs font-semibold uppercase tracking-widest">Contato Imediato</h5>
            <p className="text-sm font-light text-white/60">reservas@opalaristorante.com</p>
            <p className="text-sm font-light text-white/60">+244 923 888 888</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-white/5 pt-8 text-center text-xs font-light">
          &copy; {new Date().getFullYear()} Opala Ristorante S.A. Todos os direitos reservados.
        </div>
      </footer>

      {/* MODAL: PRODUCT DETAIL PAGE */}
      <AnimatePresence>
        {selectedProduct && (
          <div id="product-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto z-10 grid md:grid-cols-2 shadow-2xl"
            >
              {/* Left Column: Media */}
              <div className="relative h-64 md:h-full min-h-[300px]">
                <img 
                  src={selectedProduct.image} 
                  alt={selectedProduct.name} 
                  className="w-full h-full object-cover"
                />
                <button 
                  id="close-product-modal"
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-4 left-4 bg-black/60 hover:bg-black p-2 rounded-full border border-white/10 text-white md:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Right Column: Details & Customizations */}
              <div className="p-8 space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <h2 className="text-2xl font-medium tracking-tight text-white">{selectedProduct.name}</h2>
                    <span className="text-xl text-amber-500 font-semibold">Kz {selectedProduct.price.toFixed(2)}</span>
                  </div>

                  <p className="text-gray-400 text-sm leading-relaxed font-light">{selectedProduct.description}</p>

                  {/* Ingredients */}
                  <div className="space-y-1.5">
                    <span className="text-xs uppercase tracking-widest text-gray-500 font-bold block">Ingredientes principais</span>
                    <p className="text-xs text-gray-300 font-light">{selectedProduct.ingredients.join(" • ")}</p>
                  </div>

                  {/* Nutrition */}
                  <div className="space-y-2">
                    <span className="text-xs uppercase tracking-widest text-gray-500 font-bold block">Tabela Nutricional (Aprox)</span>
                    <div className="grid grid-cols-4 gap-2 bg-zinc-900/40 border border-white/5 rounded-lg p-2.5 text-center text-[10px]">
                      <div>
                        <span className="text-gray-500 block">Calorias</span>
                        <span className="font-semibold text-white">{selectedProduct.nutritionalValue.calories} kcal</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Proteínas</span>
                        <span className="font-semibold text-white">{selectedProduct.nutritionalValue.protein}g</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Carboidratos</span>
                        <span className="font-semibold text-white">{selectedProduct.nutritionalValue.carbs}g</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block">Gorduras</span>
                        <span className="font-semibold text-white">{selectedProduct.nutritionalValue.fat}g</span>
                      </div>
                    </div>
                  </div>

                  {/* Extras Selection */}
                  {selectedProduct.extras.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <span className="text-xs uppercase tracking-widest text-white/50 font-bold block">Adicionar Extras</span>
                      <div className="space-y-2">
                        {selectedProduct.extras.map(ex => {
                          const isSelected = selectedExtras.some(e => e.name === ex.name);
                          return (
                            <button 
                              key={ex.name}
                              type="button"
                              onClick={() => {
                               if (isSelected) {
                                  setSelectedExtras(selectedExtras.filter(e => e.name !== ex.name));
                                } else {
                                  setSelectedExtras([...selectedExtras, ex]);
                                }
                              }}
                              className={`w-full flex justify-between items-center text-xs p-3 rounded-lg border transition-all ${
                                isSelected 
                                  ? 'bg-gold/15 border-gold/40 text-white' 
                                  : 'bg-black/40 border-white/5 text-gray-400 hover:border-white/15'
                              }`}
                            >
                              <span>{ex.name}</span>
                              <span className="text-gold">+ Kz {ex.price.toFixed(2)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sauce selection */}
                  {selectedProduct.sauces.length > 0 && (
                    <div className="space-y-2.5">
                      <span className="text-xs uppercase tracking-widest text-white/50 font-bold block">Escolher Molho / Acompanhamento</span>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedProduct.sauces.map(sauce => (
                          <button 
                            key={sauce}
                            type="button"
                            onClick={() => setSelectedSauce(sauce)}
                            className={`text-[11px] p-2.5 rounded-lg border text-center transition-all ${
                              selectedSauce === sauce
                                ? 'bg-gold/15 border-gold/40 text-gold font-medium'
                                : 'bg-black/40 border-white/5 text-gray-400 hover:border-white/15'
                            }`}
                          >
                            {sauce}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <span className="text-xs uppercase tracking-widest text-white/50 font-bold block">Observações do Prato</span>
                    <input 
                      type="text" 
                      placeholder="Ex: sem cebola, ponto de carne mais passado..."
                      value={productNotes}
                      onChange={(e) => setProductNotes(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 px-3 text-xs text-white focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/50 uppercase tracking-widest font-bold">Quantidade</span>
                    <div className="flex items-center gap-4 bg-black/40 border border-white/10 rounded-lg p-1.5">
                      <button 
                        onClick={() => setProductQty(Math.max(1, productQty - 1))}
                        className="p-1 text-white/50 hover:text-white"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-semibold text-white w-6 text-center">{productQty}</span>
                      <button 
                        onClick={() => setProductQty(productQty + 1)}
                        className="p-1 text-white/50 hover:text-white"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedProduct(null)}
                      className="flex-1 bg-transparent hover:bg-white/5 text-white/60 hover:text-white border border-white/10 py-3.5 rounded-lg text-xs tracking-widest uppercase transition-colors"
                    >
                      Voltar
                    </button>
                    <button 
                      id="add-to-cart-action"
                      onClick={handleAddToCart}
                      className="flex-1 bg-gold hover:bg-gold-hover text-black font-bold py-3.5 rounded-lg text-xs tracking-widest uppercase transition-colors"
                    >
                      Adicionar ao Pedido
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DRAWER: SHOPPING CART */}
      <AnimatePresence>
        {isCartOpen && (
          <div id="cart-drawer" className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsCartOpen(false)} />
            
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="relative bg-zinc-950 border-l border-white/10 w-full max-w-md h-full flex flex-col justify-between shadow-2xl z-10"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-medium">Seu Pedido</h3>
                  <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                    {cart.length}
                  </span>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Items Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                    <ShoppingBag className="w-12 h-12 text-zinc-800" />
                    <h4 className="text-base font-medium text-gray-400">Seu carrinho está vazio</h4>
                    <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                      Visite nosso menu e monte seu pedido completo com o melhor da alta gastronomia.
                    </p>
                    <button 
                      onClick={() => { setIsCartOpen(false); setActiveTab('menu'); }}
                      className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-4 py-2 rounded-lg hover:bg-amber-500/20"
                    >
                      Ver Cardápio
                    </button>
                  </div>
                ) : (
                  cart.map((item, index) => {
                    const extrasSum = item.selectedExtras.reduce((s, ex) => s + ex.price, 0);
                    const itemTotal = (item.menuItem.price + extrasSum) * item.quantity;
                    return (
                      <div key={index} className="flex gap-4 border-b border-white/5 pb-4">
                        <img 
                          src={item.menuItem.image} 
                          alt={item.menuItem.name} 
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-start">
                            <h4 className="text-sm font-medium">{item.menuItem.name}</h4>
                            <span className="text-sm text-amber-500 font-semibold">Kz {itemTotal.toFixed(2)}</span>
                          </div>
                          
                          <div className="text-[10px] text-gray-400 font-light space-y-0.5">
                            <p>Qtd: {item.quantity} x Kz {item.menuItem.price.toFixed(2)}</p>
                            {item.selectedSauce && <p>Molho: {item.selectedSauce}</p>}
                            {item.selectedExtras.length > 0 && (
                              <p>Extras: {item.selectedExtras.map(e => `${e.name} (+Kz ${e.price})`).join(", ")}</p>
                            )}
                            {item.notes && <p className="italic">Obs: "{item.notes}"</p>}
                          </div>

                          <button 
                            onClick={() => handleRemoveFromCart(index)}
                            className="text-[10px] text-red-400 hover:underline pt-1"
                          >
                            Excluir item
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Summary and Pay Area */}
              {cart.length > 0 && (
                <div className="p-6 bg-zinc-900/60 border-t border-white/5 space-y-6">
                  
                  {/* Dynamic Fields */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold block">Seu Nome para Identificar</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Ex: Alexandre Silva"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-gold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold block">Cupom de Desconto</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Ex: OPALA10"
                          value={appliedCoupon}
                          onChange={(e) => setAppliedCoupon(e.target.value)}
                          className="flex-1 bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white focus:outline-none focus:border-gold"
                        />
                        <button 
                          onClick={handleApplyCoupon}
                          className="bg-white/10 text-white text-xs px-4 rounded-lg hover:bg-white/20 transition-colors border border-white/10"
                        >
                          Aplicar
                        </button>
                      </div>
                      {couponMessage && (
                        <p className={`text-[10px] ${couponDiscount > 0 ? 'text-green-400' : 'text-red-400'}`}>{couponMessage}</p>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest text-white/50 font-bold block">Forma de Pagamento</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'cartao', label: 'Cartão de Crédito/Débito' },
                          { id: 'transferência', label: 'Pix / Transferência' },
                          { id: 'dinheiro', label: 'Dinheiro (Físico)' },
                          { id: 'online', label: 'Pagamento Digital' }
                        ].map(pm => (
                          <button 
                            key={pm.id}
                            type="button"
                            onClick={() => setPaymentMethod(pm.id as any)}
                            className={`text-[10px] p-2 rounded-lg border text-center transition-all ${
                              paymentMethod === pm.id
                                ? 'bg-gold/15 border-gold/40 text-gold font-semibold'
                                : 'bg-black/40 border-white/5 text-gray-400 hover:border-white/12'
                            }`}
                          >
                            {pm.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-2 border-t border-white/5 pt-4 text-xs">
                    <div className="flex justify-between text-white/50">
                      <span>Subtotal</span>
                      <span>Kz {cartSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-white/50">
                      <span>Taxa de serviço (10%)</span>
                      <span>Kz {cartTax.toFixed(2)}</span>
                    </div>
                    {cartDiscount > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Desconto</span>
                        <span>- Kz {cartDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-white font-semibold text-sm pt-2 border-t border-white/5">
                      <span>Total do Pedido</span>
                      <span className="text-gold">Kz {cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <button 
                    id="checkout-action"
                    onClick={handleCheckout}
                    className="w-full bg-gold hover:bg-gold-hover text-black font-extrabold py-4 rounded-full text-xs tracking-widest uppercase transition-all shadow-lg shadow-gold/10"
                  >
                    Enviar Pedido para Cozinha
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TRACKING MODAL */}
      <AnimatePresence>
        {isTrackingOpen && activePlacedOrder && (
          <div id="tracking-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsTrackingOpen(false)} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-xl p-8 shadow-2xl z-10 text-center space-y-6"
            >
              <button 
                onClick={() => setIsTrackingOpen(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <span className="text-xs uppercase bg-gold/15 text-gold border border-gold/30 px-3.5 py-1.5 rounded-full tracking-wider font-bold">
                  Acompanhamento Real-Time
                </span>
                <h3 className="text-2xl font-serif pt-4 text-white">Código do Pedido: {activePlacedOrder.id}</h3>
                <p className="text-xs text-white/40 font-light">Mesa associada: {activePlacedOrder.tableId || "Delivery"}</p>
              </div>

              {/* Status Visual Tracking Line */}
              <div className="py-8 relative">
                {/* Line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/5 -translate-x-1/2" />

                {/* Steps */}
                <div className="space-y-6 relative z-10">
                  {[
                    { id: 'recebido', label: 'Pedido Recebido', desc: 'Sua solicitação foi registrada e está na fila.' },
                    { id: 'preparando', label: 'Em Preparação', desc: 'Nossos chefs de alta gastronomia estão preparando seu prato.' },
                    { id: 'pronto', label: 'Pronto', desc: 'Seu prato atingiu a temperatura perfeita e está montado.' },
                    { id: 'entregue', label: 'Entregue', desc: 'Pedido servido na sua mesa. Aproveite a experiência!' }
                  ].map((step, idx) => {
                    const statusOrder = ['recebido', 'preparando', 'pronto', 'entregue', 'cancelado'];
                    const currentIdx = statusOrder.indexOf(activePlacedOrder.status);
                    const stepIdx = statusOrder.indexOf(step.id);
                    
                    const isDone = currentIdx >= stepIdx && activePlacedOrder.status !== 'cancelado';
                    const isCurrent = activePlacedOrder.status === step.id;

                    return (
                      <div key={step.id} className="flex gap-4 items-start text-left max-w-md mx-auto">
                        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isDone 
                            ? 'bg-gold border-gold text-black font-bold' 
                            : 'bg-zinc-950 border-white/10 text-white/40'
                        } ${isCurrent ? 'ring-4 ring-gold/20' : ''}`}>
                          {isDone ? <CheckCircle2 className="w-4 h-4 text-black" /> : <span>{idx + 1}</span>}
                        </div>
                        <div>
                          <h4 className={`text-sm font-medium ${isDone ? 'text-white' : 'text-white/40'}`}>{step.label}</h4>
                          <p className="text-xs text-white/40 leading-relaxed font-light">{step.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activePlacedOrder.status === 'cancelado' && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-2 text-xs text-left max-w-sm mx-auto">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>Este pedido foi cancelado pelo salão. Por favor, acione um garçom ou fale no WhatsApp do restaurante.</span>
                </div>
              )}

              <div className="space-y-1.5 pt-4 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-white/40 block">Tempo médio estimado</span>
                <span className="text-2xl font-serif text-gold block">15 a 25 Minutos</span>
                <p className="text-[10px] text-white/40 font-light italic">
                  O painel da cozinha atualiza o status instantaneamente. Mantenha essa tela aberta para acompanhar em tempo real.
                </p>
              </div>

              <button 
                onClick={() => setIsTrackingOpen(false)}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 py-3 rounded-full text-xs tracking-widest uppercase transition-colors"
              >
                Minimizar Acompanhamento
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
