import { Wine, UtensilsCrossed } from "lucide-react";
import type { MenuItem } from "../types";
import { getDishPhoto } from "../utils/photos";

type Props = {
  item: Pick<MenuItem, "id" | "name" | "image" | "category">;
  className?: string;
  fade?: boolean;       // esbate o fundo da foto no corpo do cartão
  showLabel?: boolean;  // mostra "Imagem ilustrativa" quando não é foto própria
  iconSize?: string;
};

export default function DishPhoto({ item, className = "", fade = false, showLabel = false, iconSize = "w-12 h-12" }: Props) {
  const { src, real, fit } = getDishPhoto(item);
  const Icon = item.category === "bebidas" ? Wine : UtensilsCrossed;

  return (
    <div className={`relative overflow-hidden bg-[#272727] ${className}`}>
      {src ? (
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          className={`w-full h-full ${fit === "cover" ? "object-cover object-[50%_65%]" : "object-contain"} transition-transform duration-700 group-hover:scale-105`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1b1b1b] via-[#242424] to-[#3a2c08]">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "url('/img/fundo-icones.jpg')", backgroundSize: "260px" }} />
          <div className="relative w-20 h-20 rounded-full border border-gold/40 bg-black/30 flex items-center justify-center">
            <Icon className={`${iconSize} text-gold`} strokeWidth={1.2} />
          </div>
        </div>
      )}
      {fade && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#141414] to-transparent pointer-events-none" />}
      {showLabel && src && !real && (
        <span className="absolute bottom-2 right-4 text-[8px] uppercase tracking-[0.2em] text-white/40">Imagem ilustrativa</span>
      )}
    </div>
  );
}
