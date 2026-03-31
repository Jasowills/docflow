import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileText,
  Menu,
  X,
  PlayCircle,
  Rocket,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../auth/auth-context';
import docflowLogo from '../assets/docflow-logo-light.svg';
import recordingsVisual from '../assets/docflow-showcase-dashboard.png';
import documentsVisual from '../assets/docflow-showcase-documents.png';
import generateVisual from '../assets/docflow-showcase-testplans.png';

const HeroScene = lazy(async () => import('../components/landing/HeroScene').then((module) => ({
  default: module.HeroScene,
})));

const featureCards = [
  {
    icon: Workflow,
    title: 'Capture browser workflows',
    body: 'Use the DocFlow recorder to capture website and web app flows with structured steps, events, and context.',
  },
  {
    icon: FileText,
    title: 'Generate operational documents',
    body: 'Turn a recording into user guides, tutorials, test case suites, and release notes from one generation flow.',
  },
];

const workflowSteps = [
  'Capture a workflow with the DocFlow recorder or upload a prepared recording.',
  'Generate one or more document types from the captured session.',
  'Review and organize output inside the Documents workspace with folders and filters.',
  'Manage teammates, invites, and workspace roles from the shared settings surface.',
];

const productFrames = [
  {
    eyebrow: 'Recordings',
    title: 'Structured capture instead of raw screen recordings',
    lines: ['Session timeline', 'Event stream', 'Transcript markers', 'Capture context'],
    image: recordingsVisual,
    alt: 'DocFlow recordings view visual',
  },
  {
    eyebrow: 'Generate',
    title: 'AI-powered conversion from workflows to output',
    lines: ['Multiple document types', 'AI customization', 'Real-time preview', 'Batch generation'],
    image: generateVisual,
    alt: 'DocFlow generation and processing visual',
  },
  {
    eyebrow: 'Documents',
    title: 'Generated output built for real review and reuse',
    lines: ['Guides', 'Test suites', 'Release notes', 'Folder organization'],
    image: documentsVisual,
    alt: 'DocFlow documents and test generation visual',
  },
];

const heroTitleWords = [
  'Turn',
  'captured',
  'web',
  'workflows',
  'into',
  'docs,',
  'test',
  'cases,',
  'and',
  'release-ready',
  'assets.',
];

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    if (typeof window === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.landing-hero-copy > :not(.landing-hero-title)',
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          stagger: 0.08,
          ease: 'power3.out',
        },
      );

      gsap.fromTo(
        '.landing-hero-title-word-inner',
        {
          yPercent: 120,
          opacity: 0,
          rotateX: -72,
        },
        {
          yPercent: 0,
          opacity: 1,
          rotateX: 0,
          duration: 0.88,
          stagger: 0.045,
          ease: 'power3.out',
          delay: 0.08,
        },
      );

      gsap.fromTo(
        '.landing-hero-visual > *',
        { y: 24, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1.1,
          stagger: 0.12,
          ease: 'power3.out',
          delay: 0.18,
        },
      );

      gsap.utils.toArray<HTMLElement>('[data-reveal-section]').forEach((section: HTMLElement) => {
        gsap.fromTo(
          section,
          { y: 44, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.95,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: section,
              start: 'top 82%',
              once: true,
            },
          },
        );
      });

      gsap.utils.toArray<HTMLElement>('[data-reveal-stagger]').forEach((container: HTMLElement) => {
        const children = Array.from(container.children);
        gsap.fromTo(
          children,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: container,
              start: 'top 84%',
              once: true,
            },
          },
        );
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="landing-shell" ref={rootRef}>
      <header className="landing-nav">
        <Link to="/" className="landing-brand">
          <img src={docflowLogo} alt="DocFlow" className="landing-brand-logo" />
        </Link>
        <button
          type="button"
          className="landing-nav-toggle"
          aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileNavOpen}
          onClick={() => setMobileNavOpen((current) => !current)}
        >
          {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <nav className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#workflow">How it works</a>
          <a href="#product">Product</a>
          <a href="#roadmap">Roadmap</a>
        </nav>
        <div className="landing-nav-actions">
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/app/dashboard">
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Link to="/login" className="landing-nav-signin">
                Sign in
              </Link>
              <Button asChild>
                <Link to="/login">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
        <div className={`landing-mobile-nav ${mobileNavOpen ? 'landing-mobile-nav-open' : ''}`}>
          <a href="#features" onClick={() => setMobileNavOpen(false)}>Features</a>
          <a href="#workflow" onClick={() => setMobileNavOpen(false)}>How it works</a>
          <a href="#product" onClick={() => setMobileNavOpen(false)}>Product</a>
          <a href="#roadmap" onClick={() => setMobileNavOpen(false)}>Roadmap</a>
          {isAuthenticated ? (
            <Link to="/app/dashboard" onClick={() => setMobileNavOpen(false)}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileNavOpen(false)}>Sign in</Link>
              <Link to="/login" onClick={() => setMobileNavOpen(false)}>Start free</Link>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-pill">
              <Sparkles className="h-4 w-4" />
              AI documentation for websites and web apps
            </div>
            <h1 className="landing-hero-title">
              {heroTitleWords.map((word) => (
                <span key={word} className="landing-hero-title-word">
                  <span className="landing-hero-title-word-inner">{word}</span>
                </span>
              ))}
            </h1>
            <p className="landing-hero-body">
              DocFlow helps teams record browser workflows, generate structured documentation, and
              keep that output organized in one shared workspace. Current flows center on capture,
              generation, documents, and workspace collaboration.
            </p>
            <div className="landing-hero-actions">
              <Button asChild size="lg">
                <Link to={isAuthenticated ? '/app/dashboard' : '/login'}>
                  {isAuthenticated ? 'Open Dashboard' : 'Start with DocFlow'}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#product">
                  <PlayCircle className="h-4 w-4" />
                  Explore the product
                </a>
              </Button>
            </div>
            <div className="landing-hero-trust">
              <span>Built for websites and web apps</span>
              <span>Browser recorder included</span>
              <span>Teams + Individuals</span>
              <span>Mobile capture coming soon</span>
            </div>
            <div className="landing-hero-stats">
              <div className="landing-hero-stat">
                <strong>Record</strong>
                <span>Capture workflows with event, transcript, and session context.</span>
              </div>
              <div className="landing-hero-stat">
                <strong>Generate</strong>
                <span>Create tutorials, references, test cases, and release notes from the same source.</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-orb" />
            <Suspense fallback={<div className="landing-hero-scene landing-hero-scene-fallback" />}>
              <HeroScene />
            </Suspense>
            <div className="landing-float-card landing-float-card-primary">
              <div className="landing-float-label">Captured flow</div>
              <div className="landing-float-title">Account settings walkthrough</div>
              <div className="landing-float-metric">14 structured steps</div>
            </div>
            <div className="landing-float-card landing-float-card-secondary">
              <div className="landing-float-label">Output</div>
              <div className="landing-float-title">Tutorial, test suite, release notes</div>
              <div className="landing-float-metric">Generated from one recording</div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="features" data-reveal-section>
          <div className="landing-section-head">
            <div className="landing-section-eyebrow">Core capabilities</div>
            <h2>One recorded workflow, multiple useful outputs.</h2>
          </div>
          <div className="landing-feature-grid" data-reveal-stagger>
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="landing-feature-card">
                  <div className="landing-feature-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-section landing-section-band" id="workflow" data-reveal-section>
          <div className="landing-section-head">
            <div className="landing-section-eyebrow">How it works</div>
            <h2>Capture. Generate. Review. Share.</h2>
          </div>
          <div className="landing-workflow-grid" data-reveal-stagger>
            {workflowSteps.map((step, index) => (
              <div key={step} className="landing-workflow-step">
                <div className="landing-step-index">0{index + 1}</div>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section" id="product" data-reveal-section>
          <div className="landing-section-head">
            <div className="landing-section-eyebrow">Product visuals</div>
            <h2>A focused workspace for recording, generation, and document review.</h2>
          </div>
          <div className="landing-product-grid" data-reveal-stagger>
            {productFrames.map((frame, index) => (
              <article
                key={frame.title}
                className={`landing-product-frame ${index === 1 ? 'landing-product-frame-emphasis' : ''}`}
              >
                <div className="landing-browser-chrome">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="landing-product-eyebrow">{frame.eyebrow}</div>
                <h3>{frame.title}</h3>
                <div className="landing-product-visual">
                  <img src={frame.image} alt={frame.alt} loading="lazy" />
                </div>
                <div className="landing-product-lines">
                  {frame.lines.map((line) => (
                    <div key={line} className="landing-product-line">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" data-reveal-section>
          <div className="landing-proof-grid" data-reveal-stagger>
            <article className="landing-proof-card">
              <div className="landing-section-eyebrow">Individuals</div>
              <h3>Start with one workflow and build from there.</h3>
              <p>
                Capture flows, generate assets, and keep documents organized without needing a full team rollout on day one.
              </p>
            </article>
            <article className="landing-proof-card">
              <div className="landing-section-eyebrow">Teams</div>
              <h3>Shared workspace, shared context.</h3>
              <p>
                Invite collaborators, manage roles, and review generated documents together inside one workspace.
              </p>
            </article>
            <article className="landing-proof-card">
              <div className="landing-section-eyebrow">Coming soon</div>
              <h3>Mobile capture and deeper automation.</h3>
              <p>
                Extend DocFlow beyond browser capture with mobile workflow support and future execution automation.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-section landing-section-band" id="roadmap" data-reveal-section>
          <div className="landing-roadmap">
            <div>
              <div className="landing-section-eyebrow">Roadmap</div>
              <h2>Built for modern product delivery teams.</h2>
            </div>
            <div className="landing-roadmap-list">
              <div className="landing-roadmap-item">
                <Rocket className="h-4 w-4" />
                <span>Refined onboarding and public product surfaces</span>
              </div>
              <div className="landing-roadmap-item">
                <Rocket className="h-4 w-4" />
                <span>Workspace invitation acceptance and lifecycle completion</span>
              </div>
              <div className="landing-roadmap-item">
                <Rocket className="h-4 w-4" />
                <span>Mobile recording capture</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" data-reveal-section>
          <div className="landing-final-cta">
            <div className="landing-final-cta-copy">
              <div className="landing-section-eyebrow">Start now</div>
              <h2>Capture a workflow. Generate the documents around it.</h2>
              <p>
                DocFlow gives teams one operating surface for turning browser workflows into structured documents, test cases, and release-ready output.
              </p>
            </div>
            <div className="landing-final-cta-actions">
              <Button asChild size="lg">
                <Link to={isAuthenticated ? '/app/dashboard' : '/login'}>
                  {isAuthenticated ? 'Dashboard' : 'Start free'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#features">
                  <Compass className="h-4 w-4" />
                  Review capabilities
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src={docflowLogo} alt="DocFlow" className="landing-footer-logo" />
            <p>
              AI workflow documentation for websites and web applications, centered on capture, generation, and organized document output.
            </p>
          </div>
          <div className="landing-footer-links">
            <div className="landing-footer-column">
              <span>Product</span>
              <a href="#features">Features</a>
              <a href="#product">Product</a>
              <a href="#roadmap">Roadmap</a>
            </div>
            <div className="landing-footer-column">
              <span>Access</span>
              {isAuthenticated ? (
                <>
                  <Link to="/app/dashboard">Dashboard</Link>
                  <Link to="/app/onboarding">Onboarding</Link>
                </>
              ) : (
                <>
                  <Link to="/login">Sign in</Link>
                  <Link to="/login">Start free</Link>
                  <Link to="/login">Onboarding</Link>
                </>
              )}
            </div>
            <div className="landing-footer-column">
              <span>Platform</span>
              <a href="#workflow">Workflow capture</a>
              <a href="#product">Generated documents</a>
              <a href="#roadmap">Mobile coming soon</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
