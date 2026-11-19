import React, { useEffect, useState } from "react";
import {
  FAILED_SPRITE_URLS,
  markSpriteUrlFailed,
  resolvePokemonSpriteSpec
} from "../data/pokemonSprites";

export interface PokemonSpriteProps {
  name: string;
  size?: number;
  variant?: "mini" | "arena";
  isShadow?: boolean;
  flipX?: boolean;
  animateFloat?: boolean;
  floatDelay?: boolean;
  className?: string;
  title?: string;
}

function findNextValidIndex(urls: string[], startIndex: number): number {
  for (let i = startIndex; i < urls.length; i++) {
    if (!FAILED_SPRITE_URLS.has(urls[i])) {
      return i;
    }
  }
  return urls.length;
}

export const PokemonSprite: React.FC<PokemonSpriteProps> = ({
  name,
  size = 24,
  variant = "mini",
  isShadow,
  flipX = false,
  animateFloat = false,
  floatDelay = false,
  className = "",
  title
}) => {
  const spec = resolvePokemonSpriteSpec(name, isShadow);
  const urls = variant === "arena" ? spec.arenaUrls : spec.miniUrls;
  const [urlIndex, setUrlIndex] = useState<number>(() => findNextValidIndex(urls, 0));

  useEffect(() => {
    setUrlIndex(findNextValidIndex(urls, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, variant, isShadow, spec.slug, spec.dex]);

  const currentUrl = urlIndex < urls.length ? urls[urlIndex] : null;
  const isArena = variant === "arena";
  const floatCls = animateFloat
    ? floatDelay
      ? "animate-arena-float-delayed"
      : "animate-arena-float"
    : "";

  const fontSize = Math.max(8, Math.round(size * 0.38));

  return (
    <span
      title={title ?? name}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${floatCls} ${className}`}
    >
      {spec.isShadow && isArena && (
        <span
          aria-hidden="true"
          className="absolute inset-2 rounded-full bg-purple-500/25 blur-lg pointer-events-none"
        />
      )}

      {currentUrl ? (
        <img
          src={currentUrl}
          alt={name || "Pokémon"}
          width={size}
          height={size}
          loading={isArena ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => {
            markSpriteUrlFailed(currentUrl);
            setUrlIndex((prev) => findNextValidIndex(urls, prev + 1));
          }}
          style={{
            filter: spec.isShadow
              ? isArena
                ? "drop-shadow(0 8px 18px rgba(168, 85, 247, 0.78)) drop-shadow(0 10px 18px rgba(0, 0, 0, 0.82))"
                : "drop-shadow(0 0 3.5px rgba(168, 85, 247, 0.9))"
              : isArena
              ? "drop-shadow(0 10px 18px rgba(0, 0, 0, 0.82))"
              : undefined
          }}
          className={`w-full h-full object-contain pointer-events-none ${flipX ? "-scale-x-100" : ""}`}
        />
      ) : (
        <span
          style={{
            borderColor: spec.primaryColor,
            backgroundColor: `${spec.primaryColor}26`,
            fontSize
          }}
          className="w-full h-full rounded-full border font-extrabold text-white flex items-center justify-center leading-none tracking-tight"
        >
          {spec.monogram}
        </span>
      )}

      {spec.isShadow &&
        (isArena ? (
          <span
            aria-hidden="true"
            className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-purple-950/90 border border-purple-400/75 shadow-[0_0_8px_rgba(168,85,247,0.9)] flex items-center justify-center text-[10px] leading-none pointer-events-none"
          >
            🔥
          </span>
        ) : (
          <span
            aria-hidden="true"
            style={{
              width: size >= 26 ? 7 : 6,
              height: size >= 26 ? 7 : 6
            }}
            className="absolute bottom-0 right-0 rounded-full bg-gradient-to-tr from-purple-700 via-fuchsia-500 to-purple-200 ring-1 ring-purple-950 shadow-[0_0_4px_rgba(168,85,247,0.95)] pointer-events-none"
          />
        ))}
    </span>
  );
};
