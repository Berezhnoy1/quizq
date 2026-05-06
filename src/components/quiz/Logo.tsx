import logoSvg from "@/assets/branviq-logo.svg";

export const Logo = ({ className = "" }: { className?: string }) => (
  <img src={logoSvg} alt="BRANVIQ" className={`h-7 w-auto ${className}`} />
);

export const BQMonogram = ({ size = 56 }: { size?: number }) => (
  <div
    style={{ width: size, height: size }}
    className="rounded-2xl bg-primary text-primary-foreground font-display font-bold flex items-center justify-center text-xl shadow-card"
  >
    BQ
  </div>
);
