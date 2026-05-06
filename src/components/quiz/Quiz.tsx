import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Phone, Star, CheckCircle2, MapPin } from "lucide-react";
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

  const toggle = (key: "appliances" | "areas", v: string) =>
    setState((s) => ({
      ...s,
      [key]: s[key].includes(v) ? s[key].filter((x) => x !== v) : [...s[key], v],
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
        appliances: state.appliances,
        areas: state.areas,
        team_size: state.team_size,
        lead_source: state.lead_source,
        booked_date: state.slot?.date ?? null,
        booked_time: state.slot?.time ?? null,
        ...utm,
      });
      if (error) throw error;

      // Create calendar event (best-effort)
      if (state.slot) {
        try {
          await supabase.functions.invoke("calendar-book", {
            body: {
              startIso: state.slot.iso,
              firstName: state.first_name,
              email: state.email,
              phone: state.phone,
              notes: `Appliances: ${state.appliances.join(", ")}\nAreas: ${state.areas.join(", ")}\nTeam: ${state.team_size}\nSource: ${state.lead_source}`,
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
            <div className="flex-1"><ProgressBar step={step} total={TOTAL} /></div>
          </header>
        )}

        <main key={step} className={`flex-1 px-5 pb-6 ${direction === "fwd" ? "animate-in fade-in slide-in-from-right-4" : "animate-in fade-in slide-in-from-left-4"} duration-300`}>
          {step === 1 && <Step1 onNext={next} />}
          {step === 2 && <Step2 onNext={next} />}
          {step === 3 && (
            <StepMulti
              h1="What appliances do you repair?"
              sub="Select all that apply"
              options={APPLIANCES.map((a) => ({ id: a.id, label: a.id, Icon: a.icon }))}
              selected={state.appliances}
              onToggle={(v) => toggle("appliances", v)}
              onNext={next}
              canNext={state.appliances.length > 0}
            />
          )}
          {step === 4 && (
            <StepAreas
              selected={state.areas}
              onToggle={(v) => toggle("areas", v)}
              onNext={next}
            />
          )}
          {step === 5 && (
            <StepSingle
              h1="How many technicians work in your company?"
              options={TEAMS}
              selected={state.team_size}
              onSelect={(v) => setState((s) => ({ ...s, team_size: v }))}
              onNext={next}
            />
          )}
          {step === 6 && (
            <StepSingle
              h1="How do you currently get new clients?"
              icon={<Search className="h-5 w-5 text-primary" />}
              options={SOURCES}
              selected={state.lead_source}
              onSelect={(v) => setState((s) => ({ ...s, lead_source: v }))}
              onNext={next}
            />
          )}
          {step === 7 && (
            <Step7Booking
              selected={state.slot}
              onSelect={(slot) => setState((s) => ({ ...s, slot }))}
              onNext={next}
            />
          )}
          {step === 8 && (
            <Step8Form
              state={state}
              setState={setState}
              submitting={submitting}
              onSubmit={submit}
            />
          )}
          {step === 9 && <Step9 />}
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
          className="w-full h-full object-cover"
        />
      </div>
    </div>
    <div className="px-5 mt-6 flex-1">
      <h1 className="text-3xl font-display font-bold leading-tight text-foreground">
        Get leads for appliance repair in Atlanta
      </h1>
      <p className="mt-3 text-base text-muted-foreground leading-relaxed">
        Pay only for real job requests — not for clicks or impressions.
      </p>
    </div>
    <div className="px-5 mt-8 pb-6">
      <NextButton onClick={onNext} label="Get Started" />
      <p className="text-xs text-muted-foreground text-center mt-4">
        <a href="#" className="underline">Terms of use</a> and <a href="#" className="underline">Privacy policy</a>
      </p>
    </div>
  </div>
);

const Step2 = ({ onNext }: { onNext: () => void }) => (
  <div className="space-y-5">
    <h1 className="text-2xl font-display font-bold">Partnership Overview</h1>

    <Section title="🎯 Our Goal">
      To provide independent Atlanta techs with a steady stream of local jobs.
      No more wasting time on DIY marketing — we find real clients, and you do
      what you do best.
    </Section>

    <Section title="🛠️ Your Responsibilities">
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>• A <b className="text-foreground">$100 service credit</b> is required to start. It covers your first leads — you pay only for real requests.</li>
        <li>• Drive to clients in the Atlanta area</li>
        <li>• Handle repairs (quality is 100% on you)</li>
        <li>• Communicate with clients & get paid on-site</li>
      </ul>
    </Section>

    <Section title="✨ What We Offer">
      <ul className="space-y-3 text-sm text-muted-foreground">
        <li><b className="text-foreground">Pay-per-lead only</b> — zero monthly subscriptions, commissions, or hidden fees</li>
        <li><b className="text-foreground">Work in your ZIP codes</b> — you set your own exact service area</li>
        <li><b className="text-foreground">Total control</b> — choose which jobs to accept or decline right from your phone</li>
        <li><b className="text-foreground">Fair competition</b> — we never share a single lead with 5+ techs at the same time</li>
        <li><b className="text-foreground">Fast start</b> — onboarding takes ~2 hours, first lead within 24–48 hours</li>
      </ul>
    </Section>

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
        const isSel = selected.includes(a);
        const isLast = i === AREAS.length - 1 && AREAS.length % 2 === 1;
        return (
          <button
            key={a}
            onClick={() => onToggle(a)}
            className={`quiz-card flex flex-col gap-2 items-start ${isSel ? "selected" : ""} ${isLast ? "col-span-2" : ""}`}
          >
            <div className="w-full aspect-[16/9] rounded-lg bg-gradient-to-br from-secondary to-accent flex items-center justify-center">
              <MapPin className={`h-8 w-8 ${isSel ? "text-primary" : "text-primary/50"}`} />
            </div>
            <span className="text-sm font-medium">{a}</span>
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
  <div className="space-y-5">
    <div>
      <h1 className="text-2xl font-display font-bold">Almost done!</h1>
      <p className="text-sm text-muted-foreground mt-1">
        We'll call you at your selected time to discuss details
      </p>
    </div>

    <div className="bg-card rounded-2xl p-4 shadow-soft flex items-center gap-3">
      <BQMonogram size={44} />
      <div className="flex-1">
        <div className="font-display font-semibold">Branviq</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          <span>4.5 — your consultant</span>
        </div>
      </div>
    </div>

    <div className="space-y-3">
      <Field label="First Name *">
        <Input
          value={state.first_name}
          onChange={(e) => setState((s) => ({ ...s, first_name: e.target.value }))}
          placeholder="John"
          maxLength={60}
          className="h-12 rounded-xl"
        />
      </Field>
      <Field label="Phone *">
        <Input
          type="tel"
          value={state.phone}
          onChange={(e) => setState((s) => ({ ...s, phone: e.target.value }))}
          placeholder="+1 (404) 555-0100"
          maxLength={20}
          className="h-12 rounded-xl"
        />
      </Field>
      <Field label="Email *">
        <Input
          type="email"
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
          placeholder="you@example.com"
          maxLength={120}
          className="h-12 rounded-xl"
        />
      </Field>
    </div>

    <label className="flex items-start gap-3 cursor-pointer">
      <Checkbox
        checked={state.agreed}
        onCheckedChange={(c) => setState((s) => ({ ...s, agreed: !!c }))}
        className="mt-0.5"
      />
      <span className="text-xs text-muted-foreground leading-relaxed">
        I agree with the <a href="#" className="text-primary underline">terms of use</a> and the{" "}
        <a href="#" className="text-primary underline">privacy policy</a>
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
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
      </div>
    </div>
    <div>
      <h1 className="text-2xl font-display font-bold">Application received!</h1>
      <p className="text-sm text-muted-foreground mt-2">
        We've got everything we need — see you on the call.
      </p>
    </div>

    <div className="flex justify-center"><BQMonogram size={64} /></div>

    <div className="grid grid-cols-3 gap-3">
      {SERVICES.map((s) => (
        <div key={s.label} className="bg-card rounded-xl p-3 shadow-soft">
          <div className="text-2xl">{s.icon}</div>
          <div className="text-xs font-medium mt-1 text-muted-foreground">{s.label}</div>
        </div>
      ))}
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
      <p className="text-sm text-muted-foreground">Want to get started right away? Give us a call</p>
      <a href="tel:+18663448881" className="block">
        <Button className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-card">
          <Phone className="h-5 w-5 mr-2" />
          Call us now
        </Button>
      </a>
    </div>
  </div>
);
