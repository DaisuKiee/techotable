import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Lenis from 'lenis';
import {
  ArrowRight, CheckCircle2, Wand2, Move, Users, BookOpen, FileSpreadsheet,
  Download, Bell, Languages, ShieldCheck, CalendarCheck, GraduationCap,
  UserCheck, Building2
} from 'lucide-react';
import ctuLogo from '../assets/images/logos/ctulogo.png';
import CampusWalkLoader from '../components/CampusWalkLoader';
import ctuBg1 from '../assets/images/backgrounds/ctu-bg.jpg';
import ctuBg2 from '../assets/images/backgrounds/662332107_1498119255017069_2427715418324433071_n.jpg';
import ctuBg3 from '../assets/images/backgrounds/680448563_4304916549747910_4856050542134784312_n.jpg';
import ctuBg4 from '../assets/images/backgrounds/682398065_803515886114740_8967130645743866506_n.jpg';
import ctuBg5 from '../assets/images/backgrounds/685213306_1328240422552832_8939830790887051502_n.jpg';
import teamBenjie from '../assets/images/team/web/Benjie-Sumile.jpg';
import teamJovannie from '../assets/images/team/web/Jovannie-Congson.jpg';
import teamLourence from '../assets/images/team/web/Lourence-Zambas.jpg';
import teamMarco from '../assets/images/team/web/Marco-Montellano.jpg';
import teamVence from '../assets/images/team/web/Vence-Peter-Doble.jpg';
import teamVincent from '../assets/images/team/web/Vincent-Bernabe-Romeo.jpg';

/*
 * Landing content. Everything below describes a feature that exists in the
 * system today - the previous page was a single hero promising "AI-powered
 * timetabling" with nothing behind it to look at.
 */

const STEPS = [
  { title: 'Set up the term', text: 'Subjects, sections, rooms and faculty — typed in or imported from Excel templates.' },
  { title: 'Generate', text: 'The constraint solver places every class for a section in one pass, ranked by teaching experience.' },
  { title: 'Review & adjust', text: 'See the week as a timetable, then drag classes around. Clashes are flagged before you drop.' },
  { title: 'Publish', text: 'Publishing opens a class space per subject, where students see their schedule and posts.' },
];

const RULES = [
  'One teacher and one room per class — never double-booked',
  'A section is never in two classes at the same time',
  'Teaching load stays within each faculty member’s cap',
  'Declared unavailable hours and existing classes are worked around',
  'Lab subjects go in lab rooms; first-year NSTP prefers Saturday morning',
];

const PRIORITIES = ['Balanced', 'Teaching experience', 'Even workload', 'Compact days'];

const FEATURES = [
  { icon: Wand2, title: 'Constraint-solver generation', text: 'OR-Tools CP-SAT finds a valid timetable for a whole section, then optimises for the priority you pick.' },
  { icon: Move, title: 'Drag-and-drop builder', text: 'Place or move classes on a weekly grid. Each slot shows green, red, or “instructor busy” before you let go.' },
  { icon: UserCheck, title: 'Experience-ranked faculty', text: 'Instructors are ranked by how recently and how often they have taught the subject, with a match score.' },
  { icon: ShieldCheck, title: 'Conflict checks everywhere', text: 'Faculty, room and section clashes are rejected on save — whether the class came from the solver or by hand.' },
  { icon: BookOpen, title: 'Class spaces', text: 'Every published class gets a space for announcements and course materials, filed by section.' },
  { icon: FileSpreadsheet, title: 'Excel import', text: 'Bring in students, faculty and subjects in bulk from ready-made templates.' },
  { icon: Download, title: 'Export & print', text: 'Official schedule PDF, CSV, and a printable weekly timetable for any view.' },
  { icon: Bell, title: 'Notifications', text: 'Schedule changes and class posts reach the people they affect.' },
  { icon: Languages, title: 'English, Filipino & Cebuano', text: 'The interface follows the language each user prefers, with light and dark themes.' },
];

const ROLES = [
  { icon: ShieldCheck, role: 'Administrator', text: 'Manages accounts, approvals, and every program.' },
  { icon: CalendarCheck, role: 'Scheduling Officer', text: 'Generates, adjusts, and publishes timetables.' },
  { icon: Building2, role: 'Program Manager', text: 'Runs scheduling for their own program.' },
  { icon: Users, role: 'Faculty', text: 'Sees their load and posts to the classes they teach.' },
  { icon: GraduationCap, role: 'Student', text: 'Joins a section and follows their schedule and classes.' },
];

const PROGRAMS = [
  ['BSIT', 'BS Information Technology'],
  ['BSHM', 'BS Hospitality Management'],
  ['BIT-ET', 'BIT Electronics Technology'],
  ['BIT-CT', 'BIT Computer Technology'],
  ['BIT-AT', 'BIT Automotive Technology'],
  ['BSFI', 'BS Fisheries'],
  ['BSIE', 'BS Industrial Engineering'],
];

/* ───────────────────────── motion ───────────────────────── */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Desktop-class device: precise pointer that can hover, on a wide screen.
 * Gates the expensive per-frame scroll effects (motion blur, parallax), which
 * cost phones roughly a quarter of their frame rate for no visible benefit.
 */
const hasRichScrollEffects = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(hover: hover) and (pointer: fine) and (min-width: 1024px)').matches;

/**
 * True once the element has scrolled into view. Fires once and disconnects,
 * so content doesn't fade back out when scrolled past.
 */
const useInView = (threshold = 0.15) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(prefersReducedMotion());

  useEffect(() => {
    if (inView || !ref.current) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [inView, threshold]);

  return [ref, inView];
};

/** Fades and lifts its children in when scrolled into view. */
const Reveal = ({ children, delay = 0, as: Tag = 'div', className = '', from = 'up' }) => {
  const [ref, inView] = useInView();
  // The stagger delay only belongs to the entrance. Left in place it would also
  // delay every hover effect on the element by the same amount.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!inView) return undefined;
    const t = setTimeout(() => setSettled(true), delay + 750);
    return () => clearTimeout(t);
  }, [inView, delay]);
  const hidden = {
    up: 'translate-y-8',
    left: '-translate-x-8',
    right: 'translate-x-8',
    scale: 'scale-95',
  }[from];

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: inView && !settled ? `${delay}ms` : '0ms' }}
      className={`transition-all ease-out motion-reduce:transition-none ${settled ? 'duration-300' : 'duration-700'} ${
        inView ? 'opacity-100 translate-x-0 translate-y-0 scale-100' : `opacity-0 ${hidden}`
      } ${className}`}
    >
      {children}
    </Tag>
  );
};

const SectionHeading = ({ eyebrow, title, subtitle, align = 'center' }) => (
  <Reveal className={align === 'center' ? 'mx-auto max-w-2xl text-center' : ''}>
    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-yellow-400">{eyebrow}</p>
    <h2 className="mb-4 text-3xl font-black leading-tight text-white sm:text-4xl">{title}</h2>
    {subtitle && <p className="text-base leading-relaxed text-gray-400">{subtitle}</p>}
  </Reveal>
);

/*
 * An illustrative week in the same visual language as the builder and the
 * generator preview, so the page shows the product instead of describing it.
 * Clearly an example - no real names.
 */
const SAMPLE_BLOCKS = [
  { day: 0, start: 0, len: 2, code: 'CC 111', who: 'Intro to Computing', tone: 'bg-red-200/90 border-red-500 text-red-950' },
  { day: 0, start: 2, len: 2, code: 'GEE-TEM', who: 'Entrepreneurial Mind', tone: 'bg-amber-200/90 border-amber-500 text-amber-950' },
  { day: 1, start: 0, len: 3, code: 'GEC-RPH', who: 'Philippine History', tone: 'bg-emerald-200/90 border-emerald-500 text-emerald-950' },
  { day: 2, start: 1, len: 3, code: 'CC 112 L', who: 'Programming Lab', tone: 'bg-amber-200/90 border-amber-500 text-amber-950' },
  { day: 3, start: 0, len: 2, code: 'PATHFR 1', who: 'PE & Fitness', tone: 'bg-blue-200/90 border-blue-500 text-blue-950' },
  { day: 3, start: 2, len: 2, code: 'GEC-MMW', who: 'Mathematics', tone: 'bg-blue-200/90 border-blue-500 text-blue-950' },
  { day: 4, start: 0, len: 3, code: 'NSTP 1', who: 'Saturday-ready', tone: 'bg-blue-200/90 border-blue-500 text-blue-950' },
];

const BLOCK_STAGGER = 220; // ms between classes being "placed"

const SampleWeek = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Sat'];
  const hours = ['8AM', '9AM', '10AM', '11AM'];
  const [ref, inView] = useInView(0.35);
  const [solved, setSolved] = useState(prefersReducedMotion());

  // Flip the badge once the last class has landed.
  useEffect(() => {
    if (!inView || solved) return undefined;
    const t = setTimeout(() => setSolved(true), SAMPLE_BLOCKS.length * BLOCK_STAGGER + 450);
    return () => clearTimeout(t);
  }, [inView, solved]);

  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/40 transition-all duration-700 ease-out motion-reduce:transition-none ${
        inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-300">Generated week · example</span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold transition-colors duration-500 ${
            solved ? 'bg-emerald-400/15 text-emerald-300' : 'bg-yellow-400/15 text-yellow-300'
          }`}
        >
          {!solved && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-300" />}
          {solved ? '0 conflicts' : 'Solving…'}
        </span>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `2.5rem repeat(${days.length}, minmax(0, 1fr))`, gridTemplateRows: `auto repeat(${hours.length}, 3rem)` }}
      >
        <div />
        {days.map((d) => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide text-gray-400">{d}</div>
        ))}
        {hours.map((h, r) => (
          <div key={h} className="pr-1 text-right text-[10px] text-gray-500" style={{ gridColumn: 1, gridRow: r + 2 }}>
            {h}
          </div>
        ))}
        {SAMPLE_BLOCKS.map((b, i) => (
          <div
            key={b.code}
            className={`overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 transition-all duration-500 ease-out motion-reduce:transition-none ${b.tone} ${
              inView ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-3 scale-90'
            }`}
            style={{
              gridColumn: b.day + 2,
              gridRow: `${b.start + 2} / span ${b.len}`,
              transitionDelay: inView ? `${300 + i * BLOCK_STAGGER}ms` : '0ms',
            }}
          >
            <p className="truncate text-[11px] font-bold leading-tight">{b.code}</p>
            <p className="truncate text-[9px] leading-tight opacity-75">{b.who}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/*
 * ─────────────────────────── The team ───────────────────────────
 *
 * PLACEHOLDER ROSTER — replace name / role / links with the real capstone
 * team, and drop a photo in `photo` (import it up top) to show a portrait
 * instead of the initials. Order is display order. Add or remove members
 * freely; the grid centres whatever count you give it.
 *
 * `ring` is the avatar's halo gradient — vary it per member so the row reads
 * as individuals rather than a repeated stamp.
 */
/*
 * The real capstone team. Order here is display order — rearrange freely.
 * `role` is a placeholder until the real titles are set (e.g. Project
 * Manager, Lead Developer, UI/UX, Backend, QA, Documentation); `tint` is
 * only the fallback behind a missing photo, which none of these need.
 */
const TEAM = [
  { name: 'Benjie Sumile', role: 'Capstone Team', photo: teamBenjie, tint: 'from-sky-500 to-blue-800' },
  { name: 'Jovannie Congson', role: 'Capstone Team', photo: teamJovannie, tint: 'from-blue-600 to-indigo-900' },
  { name: 'Lourence Zambas', role: 'Capstone Team', photo: teamLourence, tint: 'from-amber-400 to-yellow-700' },
  { name: 'Marco Montellano', role: 'Project & Documentation Manager', photo: teamMarco, tint: 'from-indigo-500 to-blue-900' },
  { name: 'Vence Peter Doble', role: 'Capstone Team', photo: teamVence, tint: 'from-sky-600 to-blue-900' },
  { name: 'Vincent Bernabe Romeo', role: 'Lead Developer', photo: teamVincent, tint: 'from-blue-500 to-indigo-800' },
];

const initialsOf = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/**
 * Where a card sits in the 3-D ring, from its distance to the focused one.
 * The focused card is forward and in full colour; neighbours fall back,
 * shrink and desaturate; anything past the second ring fades out. Mirrors the
 * coverflow geometry of the pasted template, driven by CSS transforms rather
 * than a JS animation library, so it adds no dependency and respects
 * reduced-motion for free (the transition is simply disabled).
 */
const cardLayout = (offset, mobile) => {
  const g1 = mobile ? 135 : 210;
  const g2 = mobile ? 230 : 380;
  const base = { x: 0, z: 0, scale: 1, opacity: 1, gray: 100, blur: 0 };
  const map = {
    0: { x: 0, z: 0, scale: 1.08, opacity: 1, gray: 0, blur: 0 },
    1: { x: g1, z: -110, scale: 0.9, opacity: 0.92, gray: 100, blur: 0 },
    '-1': { x: -g1, z: -110, scale: 0.9, opacity: 0.92, gray: 100, blur: 0 },
    2: { x: g2, z: -320, scale: 0.78, opacity: 0.55, gray: 100, blur: 1.5 },
    '-2': { x: -g2, z: -320, scale: 0.78, opacity: 0.55, gray: 100, blur: 1.5 },
  };
  const far = { x: offset > 0 ? 520 : -520, z: -440, scale: 0.5, opacity: 0, gray: 100, blur: 2 };
  return { ...base, ...(map[offset] || far) };
};

/*
 * The people behind the system — a 3-D coverflow of the team.
 *
 * The focused member is forward and in colour with their name and role read
 * out below; the rest fan back in greyscale. Advance with the arrows, the
 * dots, a click on any card, the arrow keys, or a swipe. A giant ghost word
 * sits behind for depth, the way the reference template does, recoloured into
 * the page's own blue-and-gold rather than its stark black-and-white.
 */
const TeamSection = () => {
  const [active, setActive] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const n = TEAM.length;
  const reduce = prefersReducedMotion();

  useEffect(() => {
    const check = () => setMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const go = (next) => setActive(((next % n) + n) % n);
  const member = TEAM[active];

  /*
   * Auto-advance. The carousel turns on its own so nobody has to click to
   * meet the team. It pauses while hovered or focused — so a member stays put
   * long enough to read — and whenever the tab is hidden. Keyed on `active`
   * too, so a manual swipe or dot still gets a full dwell before the next
   * turn. Reduced-motion holds it still; the dots and swipe remain.
   */
  useEffect(() => {
    if (reduce || paused || n < 2) return undefined;
    const id = setTimeout(() => setActive((a) => (a + 1) % n), 3000);
    return () => clearTimeout(id);
  }, [active, paused, reduce, n]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Shortest signed distance from a card to the focused one, around the ring.
  const offsetFor = (i) => {
    const half = Math.floor(n / 2);
    let o = i - active;
    if (o > half) o -= n;
    if (o < -half) o += n;
    return o;
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
  };
  const onTouchStart = (e) => { touchX.current = e.changedTouches[0].screenX; };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].screenX - touchX.current;
    if (dx < -45) go(active + 1);
    else if (dx > 45) go(active - 1);
    touchX.current = null;
  };

  return (
    <section id="team" className="relative scroll-mt-20 overflow-hidden bg-gradient-to-b from-gray-950 via-blue-950/70 to-gray-950 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The people behind it"
          title="Built by students, for the campus"
          subtitle="A capstone team at CTU Daanbantayan — the people who turned a semester of scheduling headaches into one system."
        />

        <Reveal as="div" className="mt-10 sm:mt-14">
          {/* The autoplay holds while the pointer or keyboard is on the
              carousel, so whoever you're looking at stays put to be read. */}
          <div
            className="relative select-none"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
          {/* Ghost word behind the ring, for depth. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -z-0 -translate-x-1/2 -translate-y-[58%] whitespace-nowrap text-[7rem] leading-none text-transparent sm:text-[12rem] lg:text-[15rem]"
            style={{ fontFamily: "'Bebas Neue', sans-serif", WebkitTextStroke: '2px rgba(96,165,250,0.11)' }}
          >
            THE TEAM
          </span>

          <div
            tabIndex={0}
            onKeyDown={onKeyDown}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            role="group"
            aria-roledescription="carousel"
            className="relative mx-auto h-[360px] w-full [perspective:1200px] focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/50 sm:h-[440px]"
            aria-label={`Project team. Showing ${member.name}, ${member.role}. Use the arrow keys to browse.`}
          >
            <div className="relative h-full w-full [transform-style:preserve-3d]">
              {TEAM.map((m, i) => {
                const o = offsetFor(i);
                const L = cardLayout(o, mobile);
                const focused = o === 0;
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => go(i)}
                    aria-label={focused ? `${m.name}, ${m.role}` : `Show ${m.name}`}
                    aria-hidden={L.opacity === 0}
                    tabIndex={L.opacity === 0 ? -1 : 0}
                    className={`absolute left-1/2 top-1/2 h-[320px] w-[230px] overflow-hidden rounded-2xl border text-left shadow-2xl shadow-black/60 transition-[transform,opacity,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:h-[380px] sm:w-[270px] ${
                      focused ? 'border-yellow-400/60' : 'border-white/10'
                    }`}
                    style={{
                      transform: `translate(-50%,-50%) translate3d(${L.x}px,0,${L.z}px) scale(${L.scale})`,
                      opacity: L.opacity,
                      filter: `grayscale(${L.gray}%) blur(${reduce ? 0 : L.blur}px)`,
                      zIndex: 20 - Math.abs(o),
                      pointerEvents: L.opacity === 0 ? 'none' : 'auto',
                    }}
                  >
                    {m.photo ? (
                      <img src={m.photo} alt={m.name} draggable="false" className="h-full w-full object-cover" />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${m.tint}`}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-7xl tracking-wide text-white/90">{initialsOf(m.name)}</span>
                      </div>
                    )}
                    {/* Legibility scrim + the focused card's accent edge-light */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    {focused && <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-yellow-300/30" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Who's in front — name and role, crossfading on change. */}
          <div key={active} className="mt-6 text-center motion-safe:animate-[memberIn_0.5s_ease] sm:mt-8">
            <h3 style={{ fontFamily: "'Bebas Neue', sans-serif" }} className="text-4xl tracking-wide text-white sm:text-5xl">{member.name}</h3>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-yellow-300/90">{member.role}</p>
          </div>

          {/* Progress dots. The carousel advances on its own; these show
              where it is, and still let you jump to someone directly. */}
          <div className="mt-7 flex items-center justify-center gap-2.5">
            {TEAM.map((m, i) => (
              <button
                key={m.name}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${m.name}`}
                aria-current={i === active}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === active ? 'w-6 bg-yellow-400' : 'w-2 bg-white/25 hover:bg-yellow-400/60'
                }`}
              />
            ))}
          </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const navRef = useRef(null);
  const [slide, setSlide] = useState({ current: 0, fading: null });
  const currentSlide = slide.current;
  const fadingSlide = slide.fading;
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const heroImages = [ctuBg1, ctuBg2, ctuBg3, ctuBg4, ctuBg5];

  // Both buttons share the logo transition. "Get Started" is for new users and
  // goes to sign-up; "Log in" is for anyone who already has an account.
  const goTo = (path) => {
    setNavigating(true);
    setTimeout(() => navigate(path), 800);
  };
  const handleNavigateToLogin = () => goTo('/signup');
  const handleLogin = () => goTo('/login');



  // Preloader effect with fade transition
  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setFadeOut(true); // Start fade out animation
    }, 1800); // Start fading at 1.8 seconds

    const hideTimer = setTimeout(() => {
      setLoading(false); // Remove preloader
      // Trigger hero animation after preloader
      setTimeout(() => setHeroVisible(true), 50);
    }, 2200); // Complete removal at 2.2 seconds

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  /*
   * Inertia scrolling (Lenis). Wheel and trackpad input is eased into a smooth
   * glide instead of jumping in steps. Scoped to this page: it is created once
   * the preloader is gone and destroyed on the way out, so the app behind the
   * login keeps ordinary native scrolling. Skipped entirely for users who ask
   * for reduced motion. Touch keeps native scrolling, which is already smooth
   * and what phone users expect.
   */
  const lenisRef = useRef(null);
  const progressRef = useRef(null);
  const parallaxRef = useRef(null);
  const blurTargetRef = useRef(null); // the scrolling content
  const blurFilterRef = useRef(null); // its <feGaussianBlur>
  const blurOnRef = useRef(false);

  useEffect(() => {
    if (loading) return undefined;

    const reduce = prefersReducedMotion();
    // Blur and parallax only where they pay off. Measured on an emulated phone
    // with a throttled CPU, the full-page motion blur dropped scrolling from
    // ~37 to ~29 fps and doubled janky frames, and parallax driven from touch
    // scroll lags behind the finger. Phones already scroll smoothly natively.
    const richMotion = !reduce && hasRichScrollEffects();
    const lenis = reduce
      ? null
      : new Lenis({
          duration: 1.25,
          easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
          smoothWheel: true,
          wheelMultiplier: 0.9,
        });
    lenisRef.current = lenis;

    // Per-frame scroll effects are written straight to the DOM rather than
    // through React state, so they never trigger a re-render while scrolling.
    // Page height is read once (and on resize), not on every scroll frame:
    // reading scrollHeight there forces a layout per frame.
    let maxScroll = 0;
    const onResize = () => { maxScroll = document.documentElement.scrollHeight - window.innerHeight; };
    onResize();
    window.addEventListener('resize', onResize);
    // Content can grow after mount (images finishing), not only on resize.
    const heightWatch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    heightWatch?.observe(document.body);

    let wasScrolled = null; // null = not yet written, so the first call always applies
    const applyScrollEffects = (y) => {
      // Only touch React state when the nav actually changes style, instead
      // of queueing an update on every scroll frame.
      const isScrolled = y > 50;
      if (isScrolled !== wasScrolled) {
        wasScrolled = isScrolled;
        if (navRef.current) navRef.current.dataset.scrolled = String(isScrolled);
      }
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, y / maxScroll) : 0})`;
      }
      if (parallaxRef.current && richMotion) {
        // Background drifts at ~35% of scroll speed for depth
        parallaxRef.current.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
      }
    };

    /*
     * Motion blur, vertical only and scaled to scroll speed. Kept deliberately
     * faint (MAX_BLUR) so text never smears into illegibility, and removed
     * outright below a small speed - leaving a filter on at rest costs
     * rendering time and softens text that should be crisp.
     */
    const MAX_BLUR = 2.2;
    const blurTarget = blurTargetRef.current; // captured for cleanup
    const applyMotionBlur = (velocity) => {
      const target = blurTargetRef.current;
      const filter = blurFilterRef.current;
      if (!target || !filter || !richMotion) return;
      const amount = Math.min(MAX_BLUR, Math.abs(velocity) * 0.09);
      if (amount < 0.25) {
        if (blurOnRef.current) {
          target.style.filter = 'none';
          blurOnRef.current = false;
        }
        return;
      }
      filter.setAttribute('stdDeviation', `0 ${amount.toFixed(2)}`);
      if (!blurOnRef.current) {
        target.style.filter = 'url(#landing-motion-blur)';
        blurOnRef.current = true;
      }
      // Guarantee it clears even if the final scroll event never reports a
      // velocity of exactly zero.
      clearTimeout(blurClearTimer);
      blurClearTimer = setTimeout(() => applyMotionBlur(0), 140);
    };
    let blurClearTimer;

    let rafId;
    if (lenis) {
      lenis.on('scroll', ({ scroll, velocity }) => {
        applyScrollEffects(scroll);
        applyMotionBlur(velocity);
      });
      const raf = (time) => {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);
    }

    // Correct state immediately, e.g. after a reload part-way down the page
    applyScrollEffects(window.scrollY);

    const onNativeScroll = () => applyScrollEffects(window.scrollY);
    if (!lenis) window.addEventListener('scroll', onNativeScroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(blurClearTimer);
      window.removeEventListener('scroll', onNativeScroll);
      window.removeEventListener('resize', onResize);
      heightWatch?.disconnect();
      lenis?.destroy();
      lenisRef.current = null;
      if (blurTarget) blurTarget.style.filter = 'none';
      blurOnRef.current = false;
    };
  }, [loading]);

  /** Glide to an in-page anchor instead of jumping to it. */
  const scrollToSection = (e, id) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -70, duration: 1.6 });
    } else {
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  /** Glide back up to the hero — the brand/logo acts as "home". */
  const scrollToTop = () => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { duration: 1.4 });
    } else {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };

  // Auto-rotate slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setSlide((s) => ({ current: (s.current + 1) % heroImages.length, fading: s.current }));
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  /*
   * Only the visible slide and the one fading out are rendered. All five used
   * to stay mounted as full-screen layers at opacity 0, which on a phone means
   * five screen-sized textures held in GPU memory and scrolled together.
   *
   * The outgoing slide is recorded in the SAME state update as the new one, so
   * it never unmounts mid-transition; it sits on top and fades out over the
   * incoming slide, giving the crossfade. It is dropped once the fade is done.
   */
  useEffect(() => {
    if (fadingSlide === null) return undefined;
    const t = setTimeout(() => setSlide((s) => ({ ...s, fading: null })), 1100);
    return () => clearTimeout(t);
  }, [currentSlide, fadingSlide]);

  const goToSlide = (index) =>
    setSlide((s) => (s.current === index ? s : { current: index, fading: s.current }));

  // Warm the cache once the page is up, so a slide never appears blank while
  // its image downloads. Cached bytes only - nothing is kept on screen.
  useEffect(() => {
    if (loading) return;
    heroImages.forEach((src) => { const img = new Image(); img.src = src; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const [richMotion] = useState(() => !prefersReducedMotion() && hasRichScrollEffects());

  // Show preloader. The walk is timed to finish just as the fade-out starts
  // at 1.8s, so the student steps through the gate as the page appears.
  if (loading) {
    return <CampusWalkLoader duration={1.9} fading={fadeOut} />;
  }

  return (
    <div className="reveal-zoom min-h-screen bg-gradient-to-br from-blue-900 via-blue-950 to-gray-950 text-white overflow-hidden">
      {/* Navigation overlay: the same walk, compressed into the 0.8s before
          the route changes */}
      {navigating && <CampusWalkLoader duration={0.8} compact />}

      {/* Lenis's required rules, inlined because the package does not export
          its stylesheet. Only present while this page is mounted. */}
      <style>{`
        html.lenis, html.lenis body { height: auto; }
        .lenis:not(.lenis-autoToggle).lenis-stopped { overflow: clip; }
        .lenis [data-lenis-prevent] { overscroll-behavior: contain; }
        .lenis.lenis-smooth iframe { pointer-events: none; }

        /* No scrollbar on the landing page: the progress line across the top
           already shows position, and a native bar fights the glide. The
           page still scrolls by wheel, trackpad, touch and keyboard. */
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }

        /* Team carousel: the focused member's name/role rising in on change. */
        @keyframes memberIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Hero headline: each line rises out from behind its own clip once
           the preloader clears. One orchestrated page-load moment. */
        .hero-line { display: block; overflow: hidden; }
        .hero-line > span {
          display: block;
          transform: translateY(110%);
          opacity: 0;
          transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.9s ease;
        }
        .hero-in .hero-line > span { transform: translateY(0); opacity: 1; }
        @media (prefers-reduced-motion: reduce) {
          .hero-line > span { transition: none; transform: none; opacity: 1; }
        }
      `}</style>

      {/* Scroll progress. Scaled per frame from the scroll handler, so it
          tracks the eased position rather than the raw wheel input. */}
      <div
        ref={progressRef}
        aria-hidden="true"
        className="fixed left-0 top-0 z-[60] h-[3px] w-full origin-left bg-gradient-to-r from-blue-400 via-yellow-400 to-yellow-300"
        style={{ transform: 'scaleX(0)' }}
      />

      {/* Navigation */}
      {/* The scrolled style is switched by a data attribute set straight on
          the DOM node from the scroll handler. It used to be React state on
          this page, so crossing the 50px threshold re-rendered every section
          of the page just to restyle the bar - a visible hitch on phones.
          Frosted glass is desktop-only: on phones the backdrop blur over the
          hero photo cost a ~350ms frame when it switched on, and a near-opaque
          bar looks the same at that size. */}
      <nav
        ref={navRef}
        data-scrolled="false"
        className="fixed w-full z-50 border-b border-transparent bg-transparent transition-all duration-300 data-[scrolled=true]:border-yellow-400/20 data-[scrolled=true]:bg-blue-900/95 data-[scrolled=true]:shadow-lg lg:data-[scrolled=true]:bg-blue-900/80 lg:data-[scrolled=true]:backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            {/* Acts as "home": clicking the brand glides back up to the hero. */}
            <button
              type="button"
              onClick={scrollToTop}
              aria-label="Back to top"
              className="group flex items-center gap-2 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 sm:gap-3"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-400 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
                <img src={ctuLogo} alt="CTU Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10 transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-yellow-400 bg-clip-text text-transparent">
                  CTU Daanbantayan
                </h1>
                {/* Dropped on phones to leave room for both buttons */}
                <p className="hidden text-[10px] text-gray-300 min-[400px]:block sm:text-xs">Smart Timetabling</p>
              </div>
            </button>

            {/* In-page nav, desktop only: the page is long enough that
                jumping beats scrolling. Each link glides via Lenis. */}
            <div className="hidden items-center gap-7 text-sm font-medium text-gray-200 lg:flex">
              {[['how-it-works', 'How it works'], ['engine', 'Engine'], ['team', 'Team']].map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => scrollToSection(e, id)}
                  className="group/nav relative transition-colors hover:text-yellow-300"
                >
                  {label}
                  <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-yellow-400 transition-all duration-300 group-hover/nav:w-full" />
                </a>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleLogin}
              className="whitespace-nowrap rounded-xl border border-white/30 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-300 hover:border-yellow-400 hover:bg-white/10 hover:text-yellow-300 sm:px-6 sm:py-3 sm:text-base"
            >
              Log in
            </button>
            <button
              onClick={handleNavigateToLogin}
              className="group relative whitespace-nowrap px-3 py-2 sm:px-6 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-blue-600 to-blue-700 hover:from-yellow-500 hover:to-yellow-600 rounded-xl font-semibold overflow-hidden hover:shadow-2xl hover:shadow-yellow-500/50 transition-all duration-300"
            >
              <span className="relative z-10 flex items-center gap-1 sm:gap-2">
                Get Started
                <ArrowRight size={16} className="sm:w-[18px] sm:h-[18px] group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Vertical-only blur kernel, driven per frame by scroll speed. */}
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
        <defs>
          <filter id="landing-motion-blur" x="0" y="-5%" width="100%" height="110%">
            <feGaussianBlur ref={blurFilterRef} in="SourceGraphic" stdDeviation="0 0" />
          </filter>
        </defs>
      </svg>

      {/* Everything that scrolls, and so the only thing that blurs. The fixed
          nav and progress bar sit outside it on purpose: a filter makes its
          element the containing block for position:fixed descendants, which
          would pin them to the page instead of the screen. */}
      <div ref={blurTargetRef}>

      {/* Hero Section with Slideshow */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Parallax layer. Separate from the slideshow's own scale-in so the
            drift follows the scroll exactly instead of easing behind it. */}
        {/* will-change only where parallax runs: it promotes the whole hero to
            its own GPU layer, which is wasted memory on a phone. */}
        <div ref={parallaxRef} className={`absolute inset-0 ${richMotion ? 'will-change-transform' : ''}`}>
        {/* Slideshow Background */}
        <div className={`absolute inset-0 transition-transform duration-1000 ease-out ${
          heroVisible ? 'scale-100' : 'scale-110'
        }`}>
          {heroImages.map((image, index) => {
            const isCurrent = index === currentSlide;
            const isFading = index === fadingSlide;
            if (!isCurrent && !isFading) return null;
            return (
            <div
              key={index}
              className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
                isCurrent ? 'z-0 opacity-100' : 'z-10 opacity-0'
              }`}
              style={{ backgroundImage: `url(${image})` }}
            >
              {/* Lighter overlay - images more visible */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-950/60 via-blue-950/50 to-gray-950/60"></div>
              {/* Bottom blend overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-b from-transparent to-gray-950"></div>
            </div>
            );
          })}

          {/* Slideshow Indicators */}
          <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-1.5 sm:gap-2">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'w-6 sm:w-8 bg-yellow-400' 
                    : 'w-1.5 sm:w-2 bg-white/40 hover:bg-yellow-400/60'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        </div>{/* /parallax layer */}

        {/* Hero Content - Centered */}
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full text-center py-20 sm:py-24 lg:py-32 transition-all duration-1000 ease-out ${
          heroVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}>
          <div className="max-w-4xl mx-auto">
            {/* Main Headline. Each line is clipped and rises into view when
                the hero mounts — the gold line a beat behind the white one. */}
            <h1 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black mb-4 sm:mb-6 leading-tight px-2 ${heroVisible ? 'hero-in' : ''}`}>
              <span className="hero-line">
                <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text pb-1 text-transparent drop-shadow-2xl">
                  The Future of
                </span>
              </span>
              <span className="hero-line">
                <span className="bg-gradient-to-r from-blue-400 via-yellow-400 to-blue-400 bg-clip-text pb-1 text-transparent drop-shadow-2xl" style={{ transitionDelay: '0.12s' }}>
                  Academic Scheduling
                </span>
              </span>
            </h1>
            
            {/* Subtitle. Says what the system actually does rather than
                "AI-powered" - generation is constraint optimisation. */}
            <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-100 mb-8 sm:mb-10 leading-relaxed drop-shadow-lg max-w-3xl mx-auto px-4">
              Clash-free class timetables for the College of Technology Education,
              built by a constraint solver and fine-tuned by drag and drop.
              <span className="text-yellow-300 font-semibold"> No double-booked teachers, rooms, or sections.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={handleNavigateToLogin}
                className="group flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 font-bold text-blue-950 shadow-lg shadow-yellow-500/30 transition-all hover:bg-yellow-300"
              >
                Get Started
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <a
                href="#how-it-works"
                onClick={(e) => scrollToSection(e, 'how-it-works')}
                className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                See how it works
              </a>
            </div>

            {/* Scroll cue: the page now continues below the hero */}
            <a
              href="#how-it-works"
              onClick={(e) => scrollToSection(e, 'how-it-works')}
              aria-label="Scroll to how it works"
              className="mt-12 inline-flex h-10 w-6 items-start justify-center rounded-full border-2 border-white/40 p-1 transition-colors hover:border-yellow-400"
            >
              <span className="h-2 w-1 animate-bounce rounded-full bg-yellow-400 motion-reduce:animate-none" />
            </a>
          </div>
        </div>
      </section>

      {/* ── How it works: the real core loop ── */}
      <section id="how-it-works" className="relative scroll-mt-20 bg-gray-950 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title="From curriculum to published timetable"
            subtitle="Four steps, and every one of them checks for clashes before anything reaches a student."
          />

          <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <Reveal
                as="li"
                key={step.title}
                delay={i * 120}
                className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:-translate-y-1 hover:border-yellow-400/40"
              >
                <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-lg font-black text-blue-950">
                  {i + 1}
                </span>
                <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{step.text}</p>
                {/* Connector to the next step, on wide screens */}
                {i < STEPS.length - 1 && (
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-yellow-400/50 lg:block" />
                )}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Product shot: what a generated week looks like ── */}
      <section id="engine" className="scroll-mt-20 bg-gradient-to-b from-gray-950 to-blue-950 pb-20 sm:pb-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <SectionHeading
                align="left"
                eyebrow="The scheduling engine"
                title="Every class placed at once, not one at a time"
                subtitle="Google OR-Tools (CP-SAT) searches for the best timetable that breaks none of the rules. You choose what “best” means."
              />
              <ul className="mt-8 space-y-3">
                {RULES.map((rule, i) => (
                  <Reveal as="li" from="left" key={rule} delay={i * 90} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                    {rule}
                  </Reveal>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <span key={p} className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <SampleWeek />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="bg-blue-950 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Inside the system"
            title="Everything a scheduling office needs"
            subtitle="Built around how CoTE actually plans a semester."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <Reveal
                key={title}
                // Stagger per column so each row ripples in left to right
                delay={(i % 3) * 110}
                className="group rounded-2xl border border-white/10 bg-white/[0.04] p-6 hover:-translate-y-1 hover:border-yellow-400/40 hover:bg-white/[0.07] hover:shadow-xl hover:shadow-black/30"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300 transition-all duration-300 group-hover:rotate-6 group-hover:scale-110 group-hover:bg-amber-400/15 group-hover:text-amber-300">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mb-2 font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-400">{text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="bg-gradient-to-b from-blue-950 to-gray-950 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="One system, five roles"
            title="Everyone sees what they need"
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {ROLES.map(({ icon: Icon, role, text }, i) => (
              <Reveal
                key={role}
                from="scale"
                delay={i * 100}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center hover:-translate-y-1 hover:border-yellow-400/40"
              >
                <Icon className="mx-auto mb-3 h-7 w-7 text-yellow-400 transition-transform duration-300 group-hover:scale-125" />
                <h3 className="mb-1.5 text-sm font-bold text-white">{role}</h3>
                <p className="text-xs leading-relaxed text-gray-400">{text}</p>
              </Reveal>
            ))}
          </div>

          {/* Programs */}
          <div className="mt-16 text-center">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Programs supported
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PROGRAMS.map(([code, name], i) => (
                <Reveal
                  as="span"
                  from="scale"
                  key={code}
                  delay={i * 60}
                  className="cursor-default rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-gray-200 hover:border-yellow-400/50 hover:text-yellow-300"
                >
                  <span title={name}>{code}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The team ── */}
      <TeamSection />

      {/* ── Closing CTA + footer ── */}
      <section className="bg-gray-950 px-4 py-20 text-center">
        <Reveal from="scale">
        <h2 className="mb-4 text-3xl font-black sm:text-4xl">
          Ready to build this semester’s timetable?
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-gray-400">
          Sign in with your CTU account, or create one — student accounts are verified by email.
        </p>
        <button
          onClick={handleNavigateToLogin}
          className="group inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-7 py-3.5 font-bold text-blue-950 shadow-lg shadow-yellow-500/30 transition-all hover:bg-yellow-300"
        >
          Get Started
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </button>
        <p className="mt-5 text-sm text-gray-400">
          Already have an account?{' '}
          <button
            onClick={handleLogin}
            className="font-semibold text-yellow-400 underline-offset-4 hover:text-yellow-300 hover:underline"
          >
            Log in
          </button>
        </p>
        </Reveal>
      </section>

      <footer className="border-t border-white/10 bg-gray-950 py-8 text-center text-xs text-gray-500">
        <div className="mb-2 flex items-center justify-center gap-2">
          <img src={ctuLogo} alt="" className="h-6 w-6 object-contain" />
          <span className="font-semibold text-gray-300">CTU Daanbantayan · College of Technology Education</span>
        </div>
        © {new Date().getFullYear()} Capstone Group 1. 
      </footer>
      </div>{/* /motion-blur target */}
    </div>
  );
};

export default LandingPage;
