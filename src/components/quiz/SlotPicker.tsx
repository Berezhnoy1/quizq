import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Slot { date: string; time: string; iso: string }

interface Props {
  selected: { date: string; time: string; iso: string } | null;
  onSelect: (s: { date: string; time: string; iso: string }) => void;
}

export const SlotPicker = ({ selected, onSelect }: Props) => {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("calendar-availability");
        if (error) throw error;
        const s: Slot[] = data?.slots ?? [];
        setSlots(s);
        if (s[0]) setActiveDate(s[0].date);
      } catch (e: any) {
        setError(e.message ?? "Failed to load availability");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mb-3" />
        <p className="text-sm">Loading available times…</p>
      </div>
    );
  }

  if (error || slots.length === 0) {
    return (
      <div className="bg-secondary rounded-xl p-5 text-sm text-muted-foreground">
        No available times right now. Please call us at{" "}
        <a href="tel:+18663448881" className="text-primary font-semibold">+1 (866) 344-8881</a>.
      </div>
    );
  }

  const dates = Array.from(new Set(slots.map((s) => s.date)));
  const visible = slots.filter((s) => s.date === activeDate);
  const fmtDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York",
    });
  const fmtTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hh = ((h + 11) % 12) + 1;
    return `${hh}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {dates.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDate(d)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium border-2 transition ${
              activeDate === d
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40"
            }`}
          >
            {fmtDate(d)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {visible.map((s) => (
          <Button
            key={s.iso}
            variant="outline"
            onClick={() => onSelect(s)}
            className={`h-12 rounded-xl text-sm font-medium ${
              selected?.iso === s.iso
                ? "border-primary bg-accent text-primary border-2"
                : ""
            }`}
          >
            {fmtTime(s.time)}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">All times Eastern (ET)</p>
    </div>
  );
};
