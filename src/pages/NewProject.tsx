import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const INDUSTRIES = [
  'Healthcare',
  'Financial Services',
  'B2B SaaS',
  'E-commerce',
  'General/Other',
];

export default function NewProject() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    problemStatement: '',
    industry: '',
    timeline: '',
    targetUsers: '',
    additionalContext: '',
  });
  const [generateStarterContent, setGenerateStarterContent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.problemStatement.trim()) {
      toast.error('Please enter a problem statement');
      return;
    }

    if (!formData.industry) {
      toast.error('Please select an industry');
      return;
    }

    setIsSubmitting(true);

    try {
      // Generate document structure and content via edge function
      const { data: generatedData, error: genError } = await supabase.functions.invoke(
        'generate-document',
        {
          body: {
            problemStatement: formData.problemStatement,
            industry: formData.industry,
            timeline: formData.timeline,
            targetUsers: formData.targetUsers,
            additionalContext: formData.additionalContext,
            generateContent: generateStarterContent,
          },
        }
      );

      if (genError) {
        throw new Error(genError.message || 'Failed to generate document');
      }

      // Create the project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          title: 'Untitled Project',
          problem_statement: formData.problemStatement,
          industry: formData.industry,
          timeline: formData.timeline || null,
          target_users: formData.targetUsers || null,
          additional_context: formData.additionalContext || null,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create sections - use generated content or blank based on user preference
      const sections = generatedData.sections.map((section: { title: string; content: string; section_order: number }) => {
        let content = section.content;
        
        // If user opted for blank sections, only populate Problem Statement
        if (!generateStarterContent) {
          if (section.title === 'Problem Statement') {
            content = `<p>${formData.problemStatement}</p>`;
          } else {
            content = '';
          }
        }
        
        return {
          project_id: project.id,
          title: section.title,
          content,
          section_order: section.section_order,
        };
      });

      const { error: sectionsError } = await supabase
        .from('sections')
        .insert(sections);

      if (sectionsError) throw sectionsError;

      toast.success('Project created successfully!');
      navigate(`/project/${project.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
      setIsSubmitting(false);
    }
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
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Create New Project</h1>
          <p className="text-muted-foreground">
            Describe your research problem and we'll generate a structured document for you
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Provide information about your research project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="problemStatement">
                  Problem Statement <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="problemStatement"
                  placeholder="Describe the problem you're investigating..."
                  value={formData.problemStatement}
                  onChange={(e) => setFormData({ ...formData, problemStatement: e.target.value })}
                  required
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">
                  Industry <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) => setFormData({ ...formData, industry: value })}
                  required
                >
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select an industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeline">Timeline (optional)</Label>
                <Input
                  id="timeline"
                  placeholder="e.g., 3 months, 6 weeks"
                  value={formData.timeline}
                  onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetUsers">Target Users (optional)</Label>
                <Input
                  id="targetUsers"
                  placeholder="e.g., healthcare providers, patients"
                  value={formData.targetUsers}
                  onChange={(e) => setFormData({ ...formData, targetUsers: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additionalContext">Additional Context (optional)</Label>
                <Textarea
                  id="additionalContext"
                  placeholder="Any other relevant information..."
                  value={formData.additionalContext}
                  onChange={(e) => setFormData({ ...formData, additionalContext: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="generateStarter"
                    checked={generateStarterContent}
                    onCheckedChange={(checked) => setGenerateStarterContent(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="generateStarter"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Generate starter content for sections
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Uncheck for blank sections (only Problem Statement will be populated)
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating your research document...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
