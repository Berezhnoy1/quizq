export const Logo = ({ className = "" }: { className?: string }) => (
  <span className={`font-display font-bold text-primary text-xl tracking-tight ${className}`}>
    BRANVIQ
  </span>
);

export const BQMonogram = ({ size = 56 }: { size?: number }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-2xl bg-primary text-primary-foreground font-display font-bold flex items-center justify-center text-xl shadow-card"
  >
    BQ
  </div>
);
