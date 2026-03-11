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
  FolderGit2,
  Github,
  LayoutTemplate,
  Menu,
  X,
  PlayCircle,
  Rocket,
  Sparkles,
  TestTube2,
  Workflow,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../auth/auth-context';
import docflowLogo from '../assets/docflow-logo-light.svg';
import recordingsVisual from '../assets/docflow-showcase-dashboard.png';
import documentsVisual from '../assets/docflow-showcase-documents.png';
import testPlansVisual from '../assets/docflow-showcase-testplans.png';

const HeroScene = lazy(async () => import('../components/landing/HeroScene').then((module) => ({
  default: module.HeroScene,
})));

const featureCards = [
  {
    icon: Workflow,
    title: 'Capture real product flows',
    body: 'Record web workflows once and turn them into reusable product knowledge.',
  },
  {
    icon: TestTube2,
    title: 'Generate test cases and plans',
    body: 'Create structured QA assets, then attach them to repo-aware execution plans.',
  },
  {
    icon: FileText,
    title: 'Ship release-ready documentation',
    body: 'Produce user docs, internal guides, and release notes from the same captured source.',
  },
];

const workflowSteps = [
  'Record a flow with the DocFlow browser extension.',
  'Generate documents, test cases, and release notes from the captured session.',
  'Organize work in folders, plans, and workspace-level reviews.',
  'Connect GitHub repos now, then run execution flows in future automation phases.',
];

const productFrames = [
  {
    eyebrow: 'Recordings',
    title: 'Structured capture, not raw video chaos',
    lines: ['Session timeline', 'Event stream', 'Transcript markers', 'Environment context'],
    image: recordingsVisual,
    alt: 'DocFlow recordings view visual',
  },
  {
    eyebrow: 'Documents',
    title: 'AI output that reads like product operations work',
    lines: ['Guides', 'Test suites', 'Release notes', 'Review-ready formatting'],
    image: documentsVisual,
    alt: 'DocFlow documents and test generation visual',
  },
  {
    eyebrow: 'Test plans',
    title: 'GitHub-linked plans ready for automation',
    lines: ['Repository selection', 'Branch targeting', 'Environment mapping', 'Run history foundation'],
    image: testPlansVisual,
    alt: 'DocFlow test plans and execution visual',
  },
];

const heroTitleWords = [
  'Turn',
  'captured',
  'product',
  'flows',
  'into',
  'docs,',
  'test',
  'cases,',
  'plans,',
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
              AI workflow documentation for product teams
            </div>
            <h1 className="landing-hero-title">
              {heroTitleWords.map((word) => (
                <span key={word} className="landing-hero-title-word">
                  <span className="landing-hero-title-word-inner">{word}</span>
                </span>
              ))}
            </h1>
            <p className="landing-hero-body">
              DocFlow helps product, QA, and ops teams capture web workflows once, then turn them
              into structured knowledge for shipping, testing, and support. Mobile capture is next.
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
              <span>GitHub-aware</span>
              <span>Teams + Individuals</span>
              <span>Mobile capture coming soon</span>
            </div>
            <div className="landing-hero-stats">
              <div className="landing-hero-stat">
                <strong>Record</strong>
                <span>Browser-driven workflows with structured event context.</span>
              </div>
              <div className="landing-hero-stat">
                <strong>Generate</strong>
                <span>Docs, release notes, test cases, and execution-ready plans.</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-orb" />
            <Suspense fallback={<div className="landing-hero-scene landing-hero-scene-fallback" />}>
              <HeroScene />
            </Suspense>
            <div className="landing-float-card landing-float-card-primary">
              <div className="landing-float-label">Live flow</div>
              <div className="landing-float-title">Account settings QA pass</div>
              <div className="landing-float-metric">14 captured steps</div>
            </div>
            <div className="landing-float-card landing-float-card-secondary">
              <div className="landing-float-label">Output</div>
              <div className="landing-float-title">Functional, UI/UX, UAT suite</div>
              <div className="landing-float-metric">Azure DevOps-ready export</div>
            </div>
          </div>
        </section>

        <section className="landing-section" id="features" data-reveal-section>
          <div className="landing-section-head">
            <div className="landing-section-eyebrow">Core capabilities</div>
            <h2>One capture flow, multiple delivery outputs.</h2>
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
            <h2>Capture. Generate. Review. Organize.</h2>
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
            <h2>A clean operating surface for recording, planning, and delivery.</h2>
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

        <section className="landing-section landing-section-tight" data-reveal-section>
          <div className="landing-integrations">
            <div className="landing-integrations-copy">
              <div className="landing-section-eyebrow">Linked execution</div>
              <h2>Connect repositories now. Layer execution next.</h2>
              <p>
                GitHub integration and test plans are already in the product. The next automation
                layer is Playwright-first execution on top of repo-linked plans and generated cases.
              </p>
            </div>
            <div className="landing-integration-cards">
              <div className="landing-integration-card">
                <Github className="h-5 w-5" />
                <div>
                  <h3>GitHub repositories</h3>
                  <p>Connect repos, branches, and ownership context to product workflows.</p>
                </div>
              </div>
              <div className="landing-integration-card">
                <FolderGit2 className="h-5 w-5" />
                <div>
                  <h3>Execution planning</h3>
                  <p>Organize by repository, environment, and release scope.</p>
                </div>
              </div>
              <div className="landing-integration-card">
                <LayoutTemplate className="h-5 w-5" />
                <div>
                  <h3>Release notes</h3>
                  <p>Generate customer-ready release communication from the same source material.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section" data-reveal-section>
          <div className="landing-proof-grid" data-reveal-stagger>
            <article className="landing-proof-card">
              <div className="landing-section-eyebrow">Individuals</div>
              <h3>Start alone, structure later.</h3>
              <p>
                Capture flows, generate assets, and keep work organized without needing a full team setup on day one.
              </p>
            </article>
            <article className="landing-proof-card">
              <div className="landing-section-eyebrow">Teams</div>
              <h3>Shared delivery, shared context.</h3>
              <p>
                Invite collaborators, connect repositories, and review docs, plans, and QA work inside one workspace.
              </p>
            </article>
            <article className="landing-proof-card">
              <div className="landing-section-eyebrow">Coming soon</div>
              <h3>Mobile capture and automation runs.</h3>
              <p>
                Extend DocFlow beyond web recording with mobile workflow support and Playwright-first execution.
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
                <span>Public product landing experience</span>
              </div>
              <div className="landing-roadmap-item">
                <Rocket className="h-4 w-4" />
                <span>Workspace collaboration and invitation lifecycle</span>
              </div>
              <div className="landing-roadmap-item">
                <Rocket className="h-4 w-4" />
                <span>GitHub-linked test execution</span>
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
              <h2>Capture once. Generate the work that follows.</h2>
              <p>
                DocFlow gives product, QA, and delivery teams one operating surface for turning real user flows into structured output.
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
              AI workflow documentation for websites, web applications, and the next generation of delivery teams.
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
              <a href="#product">Test plans</a>
              <a href="#roadmap">Mobile coming soon</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
