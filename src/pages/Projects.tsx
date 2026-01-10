import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, LogOut, Loader2, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Project {
  id: string;
  title: string;
  problem_statement: string;
  industry: string;
  created_at: string;
  updated_at: string;
}

export default function Projects() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const industryColors: Record<string, string> = {
    'Healthcare': 'bg-emerald-100 text-emerald-800',
    'Financial Services': 'bg-blue-100 text-blue-800',
    'B2B SaaS': 'bg-violet-100 text-violet-800',
    'E-commerce': 'bg-amber-100 text-amber-800',
    'General/Other': 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">UX Research Docs</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Your Projects</h1>
            <p className="text-muted-foreground">
              Create and manage your UX research documents
            </p>
          </div>
          <Button asChild>
            <Link to="/new-project">
              <Plus className="mr-2 h-4 w-4" />
              Create New Project
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 rounded-full bg-muted p-4">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">No projects yet</h3>
              <p className="mb-6 text-center text-muted-foreground">
                Create your first UX research document to get started
              </p>
              <Button asChild>
                <Link to="/new-project">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="line-clamp-1">{project.title}</CardTitle>
                    <Badge className={industryColors[project.industry] || industryColors['General/Other']}>
                      {project.industry}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {project.problem_statement}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                  </span>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/project/${project.id}`}>Open</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
