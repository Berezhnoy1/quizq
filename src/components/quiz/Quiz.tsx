import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Phone, Star, CheckCircle2, MapPin, Clock, Users, Zap, Shield, Target, ThumbsUp } from "lucide-react";
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

interface QuizState {
  areas: string[];
  team_size: string;
  slot: { date: string; time: string; iso: string } | null;
  first_name: string;
  phone: string;
  email: string;
  agreed: boolean;
}

const initial: QuizState = {
  areas: [],
  team_size: "",
  slot: null,
  first_name: "",
  phone: "+1 ",
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
    if (!state.first_name.trim() || !state.email.trim() || state.phone.trim().length < 6 || !state.agreed) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const utm = getUTM();
      const { error } = await supabase.from("submissions").insert({
        first_name: state.first_name.trim(),
        phone: state.phone.trim(),
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
        phone: state.phone.trim(),
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

      // Confirmation email to lead (best-effort)
      supabase.functions.invoke("send-confirmation-email", {
        body: {
          firstName: state.first_name,
          email: state.email,
          phone: state.phone,
          bookedDate: state.slot?.date ?? null,
          bookedTime: state.slot?.time ?? null,
        },
      }).catch((err) => console.warn("send-confirmation-email failed", err));

      // Create calendar event (best-effort)
      if (state.slot) {
        try {
          await supabase.functions.invoke("calendar-book", {
            body: {
              startIso: state.slot.iso,
              firstName: state.first_name,
              email: state.email,
              phone: state.phone,
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
    <div className="flex items-center justify-between px-5 pt-5">
      <Logo />
    </div>
    <div className="px-5 mt-6">
      <div className="rounded-2xl overflow-hidden shadow-card aspect-[4/3] bg-secondary">
        <img
          src={heroImg}
          alt="Appliance repair technician at work in Atlanta"
          width={1024}
          height={1024}
          className="w-full h-full object-cover object-top"
        />
      </div>
    </div>
    <div className="px-5 mt-5 flex-1">
      <h1 className="text-3xl font-display font-bold leading-tight text-foreground">
        Get leads for appliance repair in Atlanta
      </h1>
      <p className="mt-2 text-base text-muted-foreground leading-relaxed">
        Pay only for real job requests — not for clicks or impressions.
      </p>
      {/* Trust signals */}
      <div className="mt-4 flex flex-col gap-2.5">
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
    <div className="px-5 mt-6 pb-6">
      <NextButton onClick={onNext} label="Get Started" />
      <p className="text-xs text-muted-foreground text-center mt-4">
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
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-display font-bold">What area of Atlanta do you work in?</h1>
      <p className="text-sm text-muted-foreground mt-1">Select all areas that apply</p>
    </div>
    <div className="grid grid-cols-2 gap-3">
      {AREAS.map((a, i) => {
        const isSel = selected.includes(a.id);
        const isLast = i === AREAS.length - 1 && AREAS.length % 2 === 1;
        return (
          <button
            key={a.id}
            onClick={() => onToggle(a.id)}
            className={`quiz-card flex flex-col gap-2 items-start ${isSel ? "selected" : ""} ${isLast ? "col-span-2" : ""}`}
          >
            <div className="w-full aspect-[16/10] rounded-lg overflow-hidden bg-secondary">
              <img
                src={a.img}
                alt={`${a.id} service area map`}
                width={512}
                height={512}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-sm font-medium">{a.id}</span>
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
            className={`quiz-card w-full flex items-center justify-between ${isSel ? "selected" : ""}`}
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

const Step8Form = ({ state, setState, submitting, onSubmit }: {
  state: QuizState; setState: React.Dispatch<React.SetStateAction<QuizState>>;
  submitting: boolean; onSubmit: () => void;
}) => (
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
      <Input
        value={state.first_name}
        onChange={(e) => setState((s) => ({ ...s, first_name: e.target.value }))}
        placeholder="First Name*"
        maxLength={60}
        className="h-14 rounded-xl bg-background border-0 placeholder:text-muted-foreground/70 text-base px-4"
      />
      <div className="flex gap-2">
        <div className="h-14 rounded-xl bg-background flex items-center px-3 gap-1.5 shrink-0">
          <span className="text-xl">🇺🇸</span>
          <span className="text-sm font-medium">+1</span>
          <ArrowRight className="h-3 w-3 rotate-90 text-muted-foreground" />
        </div>
        <Input
          type="tel"
          value={state.phone}
          onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
          placeholder="(404) 555-0100*"
          maxLength={20}
          className="h-14 rounded-xl bg-background border-0 placeholder:text-muted-foreground/70 text-base px-4 flex-1"
        />
      </div>
      <Input
        type="email"
        value={state.email}
        onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
        placeholder="Email*"
        maxLength={120}
        className="h-14 rounded-xl bg-background border-0 placeholder:text-muted-foreground/70 text-base px-4"
      />
    </div>

    <label className="flex items-start gap-3 cursor-pointer">
      <Checkbox
        checked={state.agreed}
        onCheckedChange={(c) => setState((s) => ({ ...s, agreed: !!c }))}
        className="mt-0.5 h-5 w-5 rounded data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      />
      <span className="text-sm text-muted-foreground leading-relaxed">
        I agree with <a href="#" className="text-primary underline">the terms of use and the privacy policy</a> *
      </span>
    </label>

    <NextButton
      onClick={onSubmit}
      disabled={submitting}
      label={submitting ? "Submitting…" : "Submit Application"}
    />
  </div>
);

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
