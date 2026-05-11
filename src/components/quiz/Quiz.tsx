import { useEffect, useState } from "react";
import { ArrowLeft, ChevronDown, Phone, Search, Star, CheckCircle2, MapPin, Clock, Users, Zap, Shield, Target } from "lucide-react";
import mapNorth from "@/assets/map-north.jpg";
import mapSouth from "@/assets/map-south.jpg";
import mapEast from "@/assets/map-east.jpg";
import mapWest from "@/assets/map-west.jpg";
import mapMid from "@/assets/map-mid.jpg";
import { Logo, BQMonogram } from "@/components/quiz/Logo";
import { ProgressBar } from "@/components/quiz/ProgressBar";
import { NextButton } from "@/components/quiz/NextButton";
import { SlotPicker } from "@/components/quiz/SlotPicker";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackLead, trackPageView, trackSchedule, trackStep } from "@/lib/pixel";
import { getUTM } from "@/lib/utm";
import heroImg from "@/assets/hero-technician.jpg";
import bqServices from "@/assets/bq-services.jpg";
import bqCircle from "@/assets/bq-circle.jpg";

const TOTAL = 7;
const QUESTION_STEPS = [3, 4, 5, 6]; // steps that count as "questions" in progress bar

interface Country { flag: string; name: string; code: string; minDigits: number }

interface QuizState {
  areas: string[];
  team_size: string;
  slot: { date: string; time: string; iso: string } | null;
  first_name: string;
  phone: string;
  country: Country;
  email: string;
  agreed: boolean;
}

const initial: QuizState = {
  areas: [],
  team_size: "",
  slot: null,
  first_name: "",
  phone: "",
  country: { flag: "🇺🇸", name: "United States", code: "+1", minDigits: 10 },
  email: "",
  agreed: false,
};

const AREAS: { id: string; img: string }[] = [
  { id: "North Atlanta", img: mapNorth },
  { id: "South Atlanta", img: mapSouth },
  { id: "East Atlanta", img: mapEast },
  { id: "West Atlanta", img: mapWest },
  { id: "Mid / Downtown", img: mapMid },
];
const TEAMS = ["Just me (solo)", "2–5 people", "6–10 people", "10+"];

const SERVICES = [
  { label: "Electrical", icon: "⚡" },
  { label: "HVAC", icon: "❄️" },
  { label: "Appliance", icon: "🔧" },
  { label: "Cleaning", icon: "🧽" },
  { label: "Moving", icon: "📦" },
  { label: "Plumbing", icon: "🚰" },
];

const COUNTRIES: Country[] = [
  { flag: "🇺🇸", name: "United States", code: "+1", minDigits: 10 },
  { flag: "🇨🇦", name: "Canada", code: "+1", minDigits: 10 },
  { flag: "🇲🇽", name: "Mexico", code: "+52", minDigits: 10 },
  { flag: "🇬🇧", name: "United Kingdom", code: "+44", minDigits: 10 },
  { flag: "🇩🇪", name: "Germany", code: "+49", minDigits: 10 },
  { flag: "🇫🇷", name: "France", code: "+33", minDigits: 9 },
  { flag: "🇮🇹", name: "Italy", code: "+39", minDigits: 9 },
  { flag: "🇪🇸", name: "Spain", code: "+34", minDigits: 9 },
  { flag: "🇵🇹", name: "Portugal", code: "+351", minDigits: 9 },
  { flag: "🇳🇱", name: "Netherlands", code: "+31", minDigits: 9 },
  { flag: "🇧🇪", name: "Belgium", code: "+32", minDigits: 9 },
  { flag: "🇨🇭", name: "Switzerland", code: "+41", minDigits: 9 },
  { flag: "🇦🇹", name: "Austria", code: "+43", minDigits: 9 },
  { flag: "🇸🇪", name: "Sweden", code: "+46", minDigits: 9 },
  { flag: "🇳🇴", name: "Norway", code: "+47", minDigits: 8 },
  { flag: "🇩🇰", name: "Denmark", code: "+45", minDigits: 8 },
  { flag: "🇫🇮", name: "Finland", code: "+358", minDigits: 9 },
  { flag: "🇵🇱", name: "Poland", code: "+48", minDigits: 9 },
  { flag: "🇨🇿", name: "Czech Republic", code: "+420", minDigits: 9 },
  { flag: "🇸🇰", name: "Slovakia", code: "+421", minDigits: 9 },
  { flag: "🇭🇺", name: "Hungary", code: "+36", minDigits: 8 },
  { flag: "🇷🇴", name: "Romania", code: "+40", minDigits: 9 },
  { flag: "🇧🇬", name: "Bulgaria", code: "+359", minDigits: 9 },
  { flag: "🇭🇷", name: "Croatia", code: "+385", minDigits: 9 },
  { flag: "🇷🇸", name: "Serbia", code: "+381", minDigits: 9 },
  { flag: "🇺🇦", name: "Ukraine", code: "+380", minDigits: 9 },
  { flag: "🇷🇺", name: "Russia", code: "+7", minDigits: 10 },
  { flag: "🇧🇾", name: "Belarus", code: "+375", minDigits: 9 },
  { flag: "🇲🇩", name: "Moldova", code: "+373", minDigits: 8 },
  { flag: "🇬🇪", name: "Georgia", code: "+995", minDigits: 9 },
  { flag: "🇦🇲", name: "Armenia", code: "+374", minDigits: 8 },
  { flag: "🇦🇿", name: "Azerbaijan", code: "+994", minDigits: 9 },
  { flag: "🇰🇿", name: "Kazakhstan", code: "+7", minDigits: 10 },
  { flag: "🇺🇿", name: "Uzbekistan", code: "+998", minDigits: 9 },
  { flag: "🇱🇹", name: "Lithuania", code: "+370", minDigits: 8 },
  { flag: "🇱🇻", name: "Latvia", code: "+371", minDigits: 8 },
  { flag: "🇪🇪", name: "Estonia", code: "+372", minDigits: 8 },
  { flag: "🇹🇷", name: "Turkey", code: "+90", minDigits: 10 },
  { flag: "🇮🇱", name: "Israel", code: "+972", minDigits: 9 },
  { flag: "🇸🇦", name: "Saudi Arabia", code: "+966", minDigits: 9 },
  { flag: "🇦🇪", name: "UAE", code: "+971", minDigits: 9 },
  { flag: "🇮🇳", name: "India", code: "+91", minDigits: 10 },
  { flag: "🇵🇰", name: "Pakistan", code: "+92", minDigits: 10 },
  { flag: "🇧🇩", name: "Bangladesh", code: "+880", minDigits: 10 },
  { flag: "🇱🇰", name: "Sri Lanka", code: "+94", minDigits: 9 },
  { flag: "🇨🇳", name: "China", code: "+86", minDigits: 11 },
  { flag: "🇯🇵", name: "Japan", code: "+81", minDigits: 10 },
  { flag: "🇰🇷", name: "South Korea", code: "+82", minDigits: 9 },
  { flag: "🇻🇳", name: "Vietnam", code: "+84", minDigits: 9 },
  { flag: "🇵🇭", name: "Philippines", code: "+63", minDigits: 10 },
  { flag: "🇹🇭", name: "Thailand", code: "+66", minDigits: 9 },
  { flag: "🇮🇩", name: "Indonesia", code: "+62", minDigits: 9 },
  { flag: "🇲🇾", name: "Malaysia", code: "+60", minDigits: 9 },
  { flag: "🇦🇺", name: "Australia", code: "+61", minDigits: 9 },
  { flag: "🇳🇿", name: "New Zealand", code: "+64", minDigits: 9 },
  { flag: "🇿🇦", name: "South Africa", code: "+27", minDigits: 9 },
  { flag: "🇳🇬", name: "Nigeria", code: "+234", minDigits: 8 },
  { flag: "🇬🇭", name: "Ghana", code: "+233", minDigits: 9 },
  { flag: "🇰🇪", name: "Kenya", code: "+254", minDigits: 9 },
  { flag: "🇪🇹", name: "Ethiopia", code: "+251", minDigits: 9 },
  { flag: "🇧🇷", name: "Brazil", code: "+55", minDigits: 10 },
  { flag: "🇦🇷", name: "Argentina", code: "+54", minDigits: 10 },
  { flag: "🇨🇴", name: "Colombia", code: "+57", minDigits: 10 },
  { flag: "🇨🇱", name: "Chile", code: "+56", minDigits: 9 },
  { flag: "🇵🇪", name: "Peru", code: "+51", minDigits: 9 },
];

export const Quiz = () => {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<QuizState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<"fwd" | "back">("fwd");

  useEffect(() => {
    trackPageView();
  }, []);

  useEffect(() => {
    trackStep(step);
  }, [step]);

  const next = () => { setDirection("fwd"); setStep((s) => Math.min(s + 1, TOTAL)); };
  const back = () => { setDirection("back"); setStep((s) => Math.max(s - 1, 1)); };

  const toggleArea = (v: string) =>
    setState((s) => ({
      ...s,
      areas: s.areas.includes(v) ? s.areas.filter((x) => x !== v) : [...s.areas, v],
    }));

  const submit = async () => {
    if (!state.first_name.trim() || !state.email.trim() || !state.agreed) {
      toast.error("Please fill in all required fields");
      return;
    }
    const fullPhone = `${state.country.code} ${state.phone.trim()}`;
    setSubmitting(true);
    try {
      const utm = getUTM();
      const { error } = await supabase.from("submissions").insert({
        first_name: state.first_name.trim(),
        phone: fullPhone,
        email: state.email.trim(),
        areas: state.areas,
        team_size: state.team_size,
        booked_date: state.slot?.date ?? null,
        booked_time: state.slot?.time ?? null,
        ...utm,
      });
      if (error) throw error;

      const submissionPayload = {
        first_name: state.first_name.trim(),
        phone: fullPhone,
        email: state.email.trim(),
        areas: state.areas,
        team_size: state.team_size,
        booked_date: state.slot?.date ?? null,
        booked_time: state.slot?.time ?? null,
      };

      // Google Sheets append (best-effort)
      supabase.functions.invoke("sheets-append", { body: submissionPayload })
        .catch((err) => console.warn("sheets-append failed", err));

      // Telegram notification (best-effort)
      supabase.functions.invoke("telegram-notify", { body: submissionPayload })
        .catch((err) => console.warn("telegram-notify failed", err));

      // Confirmation email via Gmail API (Domain-Wide Delegation, admin@branviq.com)
      supabase.functions.invoke("send-gmail", {
        body: {
          firstName: state.first_name,
          email: state.email,
          bookedDate: state.slot?.date ?? null,
          bookedTime: state.slot?.time ?? null,
        },
      }).catch((err) => console.warn("send-gmail failed", err));

      // Create calendar event (best-effort)
      if (state.slot) {
        try {
          await supabase.functions.invoke("calendar-book", {
            body: {
              startIso: state.slot.iso,
              firstName: state.first_name,
              email: state.email,
              phone: fullPhone,
              notes: `Areas: ${state.areas.join(", ")}\nTeam: ${state.team_size}`,
            },
          });
          trackSchedule();
        } catch (err) {
          console.warn("calendar-book failed", err);
        }
      }
      trackLead();
      next();
    } catch (e: any) {
      toast.error(e.message ?? "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const showBack = step > 1 && step < TOTAL;
  // Progress numbering: exclude intro (1) and final (7); show as 1..5
  const progressTotal = TOTAL - 2;
  const progressStep = step - 1;

  return (
    <div className="min-h-screen bg-secondary">
      <div className="mx-auto max-w-[440px] min-h-screen bg-background flex flex-col shadow-card">
        {/* Header */}
        {step !== 1 && step !== TOTAL && (
          <header className="px-5 pt-5 pb-3 flex items-center gap-3">
            {showBack ? (
              <button
                onClick={back}
                aria-label="Back"
                className="p-2 -ml-2 rounded-lg hover:bg-secondary transition"
              >
                <ArrowLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            ) : <div className="w-9" />}
            <div className="flex-1"><ProgressBar step={progressStep} total={progressTotal} /></div>
          </header>
        )}

        <main key={step} className={`flex-1 px-5 pb-6 ${direction === "fwd" ? "animate-in fade-in slide-in-from-right-4" : "animate-in fade-in slide-in-from-left-4"} duration-300`}>
          {step === 1 && <Step1 onNext={next} />}
          {step === 2 && <Step2 onNext={next} />}
          {step === 3 && (
            <StepAreas
              selected={state.areas}
              onToggle={toggleArea}
              onNext={next}
            />
          )}
          {step === 4 && (
            <StepSingle
              h1="How many technicians work in your company?"
              options={TEAMS}
              selected={state.team_size}
              onSelect={(v) => setState((s) => ({ ...s, team_size: v }))}
              onNext={next}
            />
          )}
          {step === 5 && (
            <Step7Booking
              selected={state.slot}
              onSelect={(slot) => setState((s) => ({ ...s, slot }))}
              onNext={next}
            />
          )}
          {step === 6 && (
            <Step8Form
              state={state}
              setState={setState}
              submitting={submitting}
              onSubmit={submit}
            />
          )}
          {step === 7 && <Step9 />}
        </main>
      </div>
    </div>
  );
};

/* ---------- Step components ---------- */

const Step1 = ({ onNext }: { onNext: () => void }) => (
  <div className="-mx-5 -mb-6 flex flex-col">
    <div className="flex items-center justify-between px-5 pt-4">
      <Logo />
    </div>
    <div className="px-5 mt-3">
      <div className="rounded-2xl overflow-hidden shadow-card aspect-[16/9] bg-secondary">
        <img
          src={heroImg}
          alt="Appliance repair technician at work in Atlanta"
          width={1024}
          height={576}
          className="w-full h-full object-cover object-top"
        />
      </div>
    </div>
    <div className="px-5 mt-4 flex-1">
      <h1 className="text-2xl font-display font-bold leading-tight text-foreground">
        Get leads for appliance repair in Atlanta
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        Pay only for real job requests — not for clicks or impressions.
      </p>
      {/* Trust signals */}
      <div className="mt-3 flex flex-col gap-2">
        <div className="trust-badge">
          <span className="icon"><Clock className="h-4 w-4" /></span>
          <span>First lead within 48 hours</span>
        </div>
        <div className="trust-badge">
          <span className="icon"><Users className="h-4 w-4" /></span>
          <span>100+ Atlanta techs already joined</span>
        </div>
        <div className="trust-badge">
          <span className="icon"><MapPin className="h-4 w-4" /></span>
          <span>Pay only for leads in your area</span>
        </div>
      </div>
    </div>
    <div className="px-5 mt-4 pb-5">
      <NextButton onClick={onNext} label="Get Started" />
      <p className="text-xs text-muted-foreground text-center mt-3">
        <a href="#" className="underline">Terms of use</a> and <a href="#" className="underline">Privacy policy</a>
      </p>
    </div>
  </div>
);

const Step2 = ({ onNext }: { onNext: () => void }) => (
  <div className="space-y-5">
    <h1 className="text-2xl font-display font-bold">How it works</h1>
    <p className="text-sm text-muted-foreground">Three simple steps to start getting local repair jobs</p>

    <div className="space-y-3">
      <div className="quiz-card flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-[15px]">We find the clients</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Real job requests from homeowners in your area — no cold calls, no ads to run</p>
        </div>
      </div>

      <div className="quiz-card flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-[15px]">Pay only for real leads</h3>
          <p className="text-sm text-muted-foreground mt-0.5">No subscriptions, no commissions. $100 credit to start — covers your first leads</p>
        </div>
      </div>

      <div className="quiz-card flex items-start gap-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-[15px]">Fast onboarding</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Set up takes ~2 hours. First leads within 24–48 hours. You choose which jobs to accept</p>
        </div>
      </div>
    </div>

    <NextButton onClick={onNext} />
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-card rounded-2xl p-5 shadow-soft">
    <h3 className="font-display font-semibold text-lg mb-2">{title}</h3>
    <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
  </div>
);

interface MultiOpt { id: string; label: string; Icon?: any }
const StepMulti = ({ h1, sub, options, selected, onToggle, onNext, canNext }: {
  h1: string; sub?: string; options: MultiOpt[]; selected: string[];
  onToggle: (v: string) => void; onNext: () => void; canNext: boolean;
}) => (
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-display font-bold">{h1}</h1>
      {sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}
    </div>
    <div className="grid grid-cols-2 gap-3">
      {options.map((o) => {
        const isSel = selected.includes(o.id);
        return (
          <button
            key={o.id}
            onClick={() => onToggle(o.id)}
            className={`quiz-card flex flex-col items-center text-center gap-2 ${isSel ? "selected" : ""}`}
          >
            {o.Icon && <o.Icon className={`h-7 w-7 ${isSel ? "text-primary" : "text-muted-foreground"}`} />}
            <span className="text-sm font-medium">{o.label}</span>
          </button>
        );
      })}
    </div>
    <NextButton onClick={onNext} disabled={!canNext} />
  </div>
);

const StepAreas = ({ selected, onToggle, onNext }: {
  selected: string[]; onToggle: (v: string) => void; onNext: () => void;
}) => (
  <div className="space-y-3">
    <div>
      <h1 className="text-xl font-display font-bold">What area of Atlanta do you work in?</h1>
      <p className="text-sm text-muted-foreground mt-0.5">Select all areas that apply</p>
    </div>
    <div className="grid grid-cols-3 gap-2">
      {AREAS.map((a) => {
        const isSel = selected.includes(a.id);
        return (
          <button
            key={a.id}
            onClick={() => onToggle(a.id)}
            className={`quiz-card flex flex-col gap-1 items-start p-2 ${isSel ? "selected" : ""}`}
          >
            <div className="w-full aspect-square rounded-md overflow-hidden bg-secondary">
              <img
                src={a.img}
                alt={`${a.id} service area map`}
                width={256}
                height={256}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xs font-medium leading-tight">{a.id}</span>
          </button>
        );
      })}
    </div>
    <NextButton onClick={onNext} disabled={selected.length === 0} />
  </div>
);

const StepSingle = ({ h1, options, selected, onSelect, onNext, icon }: {
  h1: string; options: string[]; selected: string;
  onSelect: (v: string) => void; onNext: () => void; icon?: React.ReactNode;
}) => (
  <div className="space-y-5">
    <div className="flex items-start gap-2">
      {icon}
      <h1 className="text-2xl font-display font-bold">{h1}</h1>
    </div>
    <div className="space-y-3">
      {options.map((o) => {
        const isSel = selected === o;
        return (
          <button
            key={o}
            onClick={() => onSelect(o)}
            className={`quiz-card quiz-card--list w-full flex items-center justify-between ${isSel ? "selected" : ""}`}
          >
            <span className="text-sm font-medium">{o}</span>
            <span className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${isSel ? "border-primary bg-primary" : "border-border"}`}>
              {isSel && <span className="h-2 w-2 bg-primary-foreground rounded-full" />}
            </span>
          </button>
        );
      })}
    </div>
    <NextButton onClick={onNext} disabled={!selected} />
  </div>
);

const Step7Booking = ({ selected, onSelect, onNext }: {
  selected: QuizState["slot"];
  onSelect: (s: NonNullable<QuizState["slot"]>) => void;
  onNext: () => void;
}) => (
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-display font-bold">Book a call with our manager</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Pick a date and time — we'll call you to explain how it works
      </p>
    </div>
    <SlotPicker selected={selected} onSelect={onSelect} />
    <NextButton onClick={onNext} disabled={!selected} />
  </div>
);

const CountryPicker = ({ selected, onSelect }: { selected: Country; onSelect: (c: Country) => void }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.includes(search),
  );

  const close = () => { setOpen(false); setSearch(""); };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-14 rounded-xl bg-background flex items-center px-3 gap-1.5 shrink-0 hover:bg-secondary transition"
      >
        <span className="text-xl">{selected.flag}</span>
        <span className="text-sm font-medium">{selected.code}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={close}
        >
          <div
            className="bg-background rounded-t-2xl w-full max-w-[440px] max-h-[72vh] flex flex-col animate-in slide-in-from-bottom-4 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2 bg-secondary rounded-xl px-3">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  placeholder="Search country or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.map((c) => (
                <button
                  key={`${c.name}`}
                  type="button"
                  onClick={() => { onSelect(c); close(); }}
                  className={`w-full flex items-center gap-3 px-5 py-3.5 hover:bg-secondary transition text-left ${
                    selected.name === c.name ? "bg-accent" : ""
                  }`}
                >
                  <span className="text-xl w-8 shrink-0">{c.flag}</span>
                  <span className="flex-1 text-sm font-medium text-foreground">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{c.code}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">No results</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Step8Form = ({
  state,
  setState,
  submitting,
  onSubmit,
}: {
  state: QuizState;
  setState: React.Dispatch<React.SetStateAction<QuizState>>;
  submitting: boolean;
  onSubmit: () => void;
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!state.first_name.trim()) e.first_name = "Name is required";
    const digits = state.phone.replace(/\D/g, "");
    if (digits.length < state.country.minDigits)
      e.phone = `At least ${state.country.minDigits} digits required`;
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(state.email.trim()))
      e.email = "Enter a valid email (e.g. you@gmail.com)";
    if (!state.agreed) e.agreed = "Please accept the terms";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => { if (validate()) onSubmit(); };

  const clearError = (key: string) =>
    setErrors((prev) => ({ ...prev, [key]: "" }));

  return (
    <div className="-mx-5 px-5 py-6 bg-secondary rounded-2xl space-y-6">
      <h1 className="text-2xl font-display font-bold text-center leading-tight">
        Almost done! We'll call you to<br />discuss details
      </h1>

      <div className="flex items-center gap-3">
        <div className="h-16 w-16 rounded-full bg-white shadow-card overflow-hidden flex items-center justify-center">
          <img src={bqCircle} alt="Branviq" className="h-12 w-12 object-contain" />
        </div>
        <div className="flex-1">
          <div className="font-display font-bold text-base">Branviq</div>
          <div className="flex items-center gap-0.5 mt-1">
            {[0,1,2,3].map(i => <Star key={i} className="h-4 w-4 fill-primary text-primary" />)}
            <Star className="h-4 w-4 fill-primary text-primary" style={{ clipPath: "inset(0 50% 0 0)" }} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Input
            value={state.first_name}
            onChange={(e) => { setState((s) => ({ ...s, first_name: e.target.value })); clearError("first_name"); }}
            placeholder="First Name*"
            maxLength={60}
            className={`h-14 rounded-xl bg-background border-0 placeholder:text-muted-foreground/70 text-base px-4 ${errors.first_name ? "ring-2 ring-destructive" : ""}`}
          />
          {errors.first_name && <p className="text-xs text-destructive mt-1 px-1">{errors.first_name}</p>}
        </div>

        <div>
          <div className="flex gap-2">
            <CountryPicker
              selected={state.country}
              onSelect={(c) => setState((s) => ({ ...s, country: c }))}
            />
            <Input
              type="tel"
              value={state.phone}
              onChange={(e) => { setState((s) => ({ ...s, phone: e.target.value })); clearError("phone"); }}
              placeholder={state.country.code === "+1" ? "(404) 555-0100*" : "Phone number*"}
              maxLength={20}
              className={`h-14 rounded-xl bg-background border-0 placeholder:text-muted-foreground/70 text-base px-4 flex-1 ${errors.phone ? "ring-2 ring-destructive" : ""}`}
            />
          </div>
          {errors.phone && <p className="text-xs text-destructive mt-1 px-1">{errors.phone}</p>}
        </div>

        <div>
          <Input
            type="email"
            value={state.email}
            onChange={(e) => { setState((s) => ({ ...s, email: e.target.value })); clearError("email"); }}
            placeholder="Email*"
            maxLength={120}
            className={`h-14 rounded-xl bg-background border-0 placeholder:text-muted-foreground/70 text-base px-4 ${errors.email ? "ring-2 ring-destructive" : ""}`}
          />
          {errors.email && <p className="text-xs text-destructive mt-1 px-1">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={state.agreed}
            onCheckedChange={(c) => { setState((s) => ({ ...s, agreed: !!c })); clearError("agreed"); }}
            className="mt-0.5 h-5 w-5 rounded"
          />
          <span className="text-sm text-muted-foreground leading-relaxed">
            I agree with <a href="#" className="text-primary underline">the terms of use and the privacy policy</a> *
          </span>
        </label>
        {errors.agreed && <p className="text-xs text-destructive mt-1 px-1">{errors.agreed}</p>}
      </div>

      <NextButton
        onClick={handleSubmit}
        disabled={submitting}
        label={submitting ? "Submitting…" : "Submit Application"}
      />
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-medium text-foreground">{label}</label>
    {children}
  </div>
);

const Step9 = () => (
  <div className="text-center space-y-6 pt-4">
    <div className="flex justify-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-check-bounce">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>
    </div>
    <div>
      <h1 className="text-2xl font-display font-bold">Application received!</h1>
      <p className="text-sm text-muted-foreground mt-2">
        We've got everything we need — see you on the call.
      </p>
    </div>

    <div className="flex justify-center">
      <img
        src={bqServices}
        alt="BQ services: electrical, HVAC, appliance, cleaning, moving, plumbing"
        className="w-full max-w-[320px] h-auto"
      />
    </div>

    <div className="bg-card rounded-2xl p-5 shadow-soft text-left space-y-3">
      <h3 className="font-display font-semibold">Next steps</h3>
      <ol className="space-y-2.5 text-sm text-muted-foreground">
        {[
          "Our manager will call you at your selected time",
          "We'll discuss the terms and help you register",
          "Account verification ~2 hours",
          "First leads in your area — within 48 hours",
        ].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </div>

    <div className="space-y-3 pt-2">
      <p className="text-sm text-foreground bg-primary/5 rounded-xl py-3 px-4">
        Want to get started right away? Give us a call
      </p>
      <a href="tel:+18663448881" className="block">
        <Button className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-card">
          <Phone className="h-5 w-5 mr-2" />
          Call us now
        </Button>
      </a>
    </div>
  </div>
);
