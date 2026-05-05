import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const NextButton = ({
  onClick,
  disabled,
  label = "Continue",
}: { onClick: () => void; disabled?: boolean; label?: string }) => (
  <Button
    onClick={onClick}
    disabled={disabled}
    className="w-full h-14 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-card disabled:opacity-40"
  >
    {label}
    <ArrowRight className="ml-2 h-5 w-5" />
  </Button>
);
