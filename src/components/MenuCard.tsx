import { motion } from "motion/react";
import { Plus } from "lucide-react";
import type { MenuItem } from "../types";
import { formatKz } from "../utils/format";
import DishPhoto from "./DishPhoto";

export default function MenuCard({ item, onOpen }: { item: MenuItem; onOpen: (i: MenuItem) => void; key?: string }) {
  return (
    <motion.article
      id={`menu-item-card-${item.id}`}
      onClick={() => onOpen(item)}
      whileHover={{ y: -6 }}
      className="group relative flex flex-col bg-[#141414] border border-white/10 hover:border-gold/50 rounded-3xl overflow-hidden cursor-pointer transition-colors shadow-[0_12px_40px_-18px_rgba(0,0,0,0.9)] hover:shadow-[0_24px_60px_-20px_rgba(255,184,0,0.28)]"
    >
      <div className="relative">
        <DishPhoto item={item} className="h-52" fade showLabel />
        {item.tags.length > 0 && (
          <div className="absolute top-4 left-4 flex gap-1.5 flex-wrap">
            {item.tags.map(tag => (
              <span key={tag} className="bg-gold text-black font-extrabold text-[9px] uppercase tracking-widest px-3 py-1 rounded-full">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="px-6 pb-6 pt-2 flex flex-col flex-1">
        <h3 className="text-xl font-serif leading-snug text-white group-hover:text-gold transition-colors">{item.name}</h3>
        <span className="block h-px w-10 bg-gold/60 my-3 group-hover:w-24 transition-all duration-500" />
        <p className="text-sm text-white/55 font-light leading-relaxed line-clamp-4 flex-1">{item.description}</p>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xl font-serif text-gold whitespace-nowrap">Kz {formatKz(item.price)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onOpen(item); }}
            aria-label={`Pedir ${item.name}`}
            className="w-10 h-10 rounded-full border border-gold/40 text-gold hover:bg-gold hover:text-black flex items-center justify-center transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
