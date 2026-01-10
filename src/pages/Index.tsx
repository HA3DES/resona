import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight, Sparkles, Layout, Lock } from 'lucide-react';

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">UX Research Docs</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Create Structured UX Research Documents with{' '}
            <span className="text-primary">AI Assistance</span>
          </h1>
          <p className="mb-10 text-xl text-muted-foreground">
            Generate industry-specific research documentation in seconds. 
            Get AI-powered suggestions to expand and refine your findings.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/signup">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t bg-muted/50 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Everything you need for UX research documentation
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Layout className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Industry Templates</h3>
              <p className="text-muted-foreground">
                Pre-built section structures for Healthcare, Financial Services, 
                B2B SaaS, E-commerce, and more.
              </p>
            </div>
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">AI-Powered Content</h3>
              <p className="text-muted-foreground">
                Get intelligent starter content and on-demand AI assistance 
                to expand and refine your research.
              </p>
            </div>
            <div className="rounded-xl bg-card p-6 shadow-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">Secure & Private</h3>
              <p className="text-muted-foreground">
                Your research documents are private and secure. 
                Only you can access your projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="mb-4 text-3xl font-bold">
            Ready to streamline your UX research?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Create your first project in under a minute.
          </p>
          <Button size="lg" asChild>
            <Link to="/signup">
              Get Started Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} UX Research Docs. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
