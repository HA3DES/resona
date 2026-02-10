import { useState, useRef } from 'react';
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
import { FileText, ArrowLeft, Loader2, Upload, X, FileUp, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const INDUSTRIES = [
  'Healthcare',
  'Financial Services',
  'B2B SaaS',
  'E-commerce',
  'General/Other',
];

type DocumentAnalysis = {
  summary: string;
  detectedIndustry: string;
  extractedProblemStatement: string;
  existingSections: { title: string; summary: string }[];
  suggestedAdditionalSections: { title: string; reason: string }[];
  extractedContent: Record<string, string>;
};

export default function NewProject() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    problemStatement: '',
    industry: '',
    timeline: '',
    targetUsers: '',
    additionalContext: '',
  });
  const [generateStarterContent, setGenerateStarterContent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File import state
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!validTypes.includes(file.type) && !hasValidExt) {
      toast.error('Please upload a PDF, DOC, or DOCX file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }

    setImportedFile(file);
    setIsAnalyzing(true);
    setDocumentAnalysis(null);

    try {
      const formDataBody = new FormData();
      formDataBody.append('file', file);

      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formDataBody,
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
      }

      const analysis: DocumentAnalysis = await response.json();
      setDocumentAnalysis(analysis);

      // Auto-fill form fields from analysis
      if (analysis.extractedProblemStatement && !formData.problemStatement) {
        setFormData((prev) => ({ ...prev, problemStatement: analysis.extractedProblemStatement }));
      }
      if (analysis.detectedIndustry && !formData.industry) {
        setFormData((prev) => ({ ...prev, industry: analysis.detectedIndustry }));
      }

      toast.success('Document analyzed successfully!');
    } catch (error) {
      console.error('Error analyzing document:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to analyze document');
      setImportedFile(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const removeFile = () => {
    setImportedFile(null);
    setDocumentAnalysis(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
            importedDocumentAnalysis: documentAnalysis || undefined,
          },
        }
      );

      if (genError) {
        throw new Error(genError.message || 'Failed to generate document');
      }

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

      const sections = generatedData.sections.map((section: { title: string; content: string; section_order: number }) => {
        let content = section.content;
        
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
            Describe your research problem or import an existing document to get started
          </p>
        </div>

        {/* File Import Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Import Existing Document
            </CardTitle>
            <CardDescription>
              Upload a PDF, DOC, or DOCX file. We'll analyze its content and suggest the right sections for your project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!importedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 px-6 py-10 transition-colors hover:border-primary/50 hover:bg-muted/40"
              >
                <Upload className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm font-medium">Click to upload or drag a file</p>
                <p className="mt-1 text-xs text-muted-foreground">PDF, DOC, DOCX up to 10MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                  <FileText className="h-8 w-8 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{importedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(importedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  {isAnalyzing ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : documentAnalysis ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : null}
                  <Button variant="ghost" size="icon" onClick={removeFile} disabled={isAnalyzing}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {isAnalyzing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing document and predicting sections...
                  </div>
                )}

                {documentAnalysis && (
                  <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Analysis Summary</p>
                    <p className="text-sm text-muted-foreground">{documentAnalysis.summary}</p>
                    
                    {documentAnalysis.existingSections.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Sections found in document:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {documentAnalysis.existingSections.map((s, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              {s.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {documentAnalysis.suggestedAdditionalSections.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Suggested additional sections:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {documentAnalysis.suggestedAdditionalSections.map((s, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                              + {s.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              {documentAnalysis
                ? "We've pre-filled some fields from your document. Review and adjust as needed."
                : 'Provide information about your research project'}
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
                      {documentAnalysis
                        ? 'Content will be generated based on your imported document and predicted sections'
                        : 'Uncheck for blank sections (only Problem Statement will be populated)'}
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting || isAnalyzing}>
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
