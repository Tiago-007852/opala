import { Plus } from "lucide-react";
import type { MenuItem } from "../types";
import { formatKz } from "../utils/format";

// Carta de bebidas em lista (nome ........ preço), agrupada por tipo.
const groups = [
  { tipo: "Cerveja", titulo: "Cervejas" },
  { tipo: "Refrigerante", titulo: "Refrigerantes" },
  { tipo: "Sumo natural", titulo: "Sumos Naturais" },
  { tipo: "Água", titulo: "Águas" },
  { tipo: "Bebida alcoólica", titulo: "Bebidas Alcoólicas" },
  { tipo: "Vinho", titulo: "Vinhos" },
];

export default function DrinksMenu({ items, onOpen }: { items: MenuItem[]; onOpen: (i: MenuItem) => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {groups.map(g => {
        const list = items.filter(i => i.description === g.tipo);
        if (list.length === 0) return null;
        return (
          <div key={g.tipo} className="bg-[#141414] border border-white/10 rounded-3xl p-7 md:p-8 shadow-[0_12px_40px_-18px_rgba(0,0,0,0.9)]">
            <h4 className="text-gold text-xs uppercase tracking-[0.3em] font-semibold mb-5 flex items-center gap-3">
              {g.titulo}
              <span className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" />
            </h4>
            <ul className="space-y-1">
              {list.map(item => (
                <li key={item.id}>
                  <button
                    id={`menu-item-card-${item.id}`}
                    onClick={() => onOpen(item)}
                    className="group w-full flex items-center gap-3 py-2.5 text-left"
                  >
                    <span className="font-serif text-lg text-white group-hover:text-gold transition-colors">{item.name}</span>
                    <span className="flex-1 border-b border-dotted border-white/20 translate-y-1" />
                    <span className="font-serif text-gold whitespace-nowrap">Kz {formatKz(item.price)}</span>
                    <span className="w-7 h-7 rounded-full border border-gold/30 text-gold group-hover:bg-gold group-hover:text-black flex items-center justify-center transition-all shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
