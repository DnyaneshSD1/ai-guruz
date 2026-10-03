import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PublicHeaderActions } from "@/components/TopBarMenus";
import { site } from "@/content/site";

const linkButton = "inline-flex h-11 items-center rounded-lg px-5 text-sm font-medium transition";

export default function LandingPage() {
  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-5">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-fg">Features</a>
            <a href="#how" className="hover:text-fg">How it works</a>
            <a href="#who" className="hover:text-fg">Who it is for</a>
            <a href="#about" className="hover:text-fg">About</a>
            <a href="#contact" className="hover:text-fg">Contact</a>
          </nav>
          <PublicHeaderActions />
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 md:pt-28">
          <p className="text-sm text-muted">{site.tagline}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">{site.hero.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{site.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className={`${linkButton} bg-primary text-primary-fg hover:opacity-85`}>Start learning</Link>
            <Link href="/login" className={`${linkButton} border border-border hover:bg-hover`}>Sign in</Link>
          </div>
          <p className="mt-6 text-xs text-muted">Available on the web, iOS and Android.</p>
        </section>

        <section id="features" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">One platform, the whole learning loop</h2>
            <p className="mt-2 max-w-2xl text-muted">From a raw document or a bare topic to measured, personalised mastery.</p>
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
              {site.features.map((feature) => (
                <div key={feature.title} className="bg-bg p-6">
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">How it works</h2>
            <ol className="mt-10 grid gap-8 md:grid-cols-4">
              {site.steps.map((step, index) => (
                <li key={step.title}>
                  <span className="font-mono text-sm text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="who" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Built for everyone in the institution</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {site.personas.map((persona) => (
                <div key={persona.role} className="rounded-xl border border-border p-5">
                  <h3 className="font-medium">{persona.role}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{persona.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{site.about.title}</h2>
              {site.about.body.map((paragraph) => (
                <p key={paragraph} className="mt-4 leading-relaxed text-muted">{paragraph}</p>
              ))}
            </div>
            <dl className="grid content-start gap-px overflow-hidden rounded-xl border border-border bg-border">
              {site.about.facts.map((fact) => (
                <div key={fact.label} className="flex items-center justify-between gap-4 bg-bg px-5 py-4">
                  <dt className="text-sm text-muted">{fact.label}</dt>
                  <dd className="text-sm font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="contact" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Talk to us</h2>
            <p className="mt-2 max-w-xl text-muted">Bring AI Guruz to your institution, or ask us anything about the platform.</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Email</p>
                <a href={`mailto:${site.contact.email}`} className="mt-1 block text-sm underline underline-offset-4">{site.contact.email}</a>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Website</p>
                <a href={`https://${site.domain}`} className="mt-1 block text-sm underline underline-offset-4">{site.domain}</a>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Office</p>
                <p className="mt-1 text-sm">{site.contact.address}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6">
          <Logo />
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} {site.company} · {site.contact.address} · <a href={`mailto:${site.contact.email}`} className="hover:text-fg">{site.contact.email}</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
