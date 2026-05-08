import { ArrowRight } from "lucide-react";

export const NextButton = ({
  onClick,
  disabled,
  label = "Continue",
}: { onClick: () => void; disabled?: boolean; label?: string }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="btn-gradient w-full h-14 text-base font-semibold rounded-xl text-white shadow-card disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
  >
    {label}
    <ArrowRight className="h-5 w-5" />
  </button>
);
