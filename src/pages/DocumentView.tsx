import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import RichTextEditor from '@/components/RichTextEditor';
import AskAIModal from '@/components/AskAIModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import debounce from '@/lib/debounce';

interface Section {
  id: string;
  title: string;
  content: string;
  section_order: number;
}

interface Project {
  id: string;
  title: string;
  problem_statement: string;
  industry: string;
}

function SortableSection({
  section,
  isActive,
  onClick,
  onDelete,
  canDelete,
}: {
  section: Section;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 rounded-md transition-colors',
        isDragging && 'opacity-50',
        isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-sidebar-accent'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab p-2 opacity-0 group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        onClick={onClick}
        className="flex-1 truncate py-2 pr-2 text-left text-sm"
      >
        {section.title}
      </button>
      {canDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [deleteSection, setDeleteSection] = useState<Section | null>(null);
  const [askAIOpen, setAskAIOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (user && id) {
      fetchProject();
    }
  }, [user, id]);

  const fetchProject = async () => {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) throw projectError;

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .select('*')
        .eq('project_id', id)
        .order('section_order', { ascending: true });

      if (sectionsError) throw sectionsError;

      setProject(projectData);
      setProjectTitle(projectData.title);
      setSections(sectionsData || []);
      if (sectionsData && sectionsData.length > 0) {
        setActiveSection(sectionsData[0]);
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Failed to load project');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (sectionId: string, content: string) => {
      setSaving(true);
      try {
        const { error } = await supabase
          .from('sections')
          .update({ content })
          .eq('id', sectionId);

        if (error) throw error;
      } catch (error) {
        console.error('Error saving section:', error);
        toast.error('Failed to save changes');
      } finally {
        setSaving(false);
      }
    }, 2000),
    []
  );

  const handleContentChange = (content: string) => {
    if (!activeSection) return;

    // Update local state immediately
    setActiveSection({ ...activeSection, content });
    setSections(sections.map((s) => 
      s.id === activeSection.id ? { ...s, content } : s
    ));

    // Debounced save to database
    debouncedSave(activeSection.id, content);
  };

  const handleProjectTitleSave = async () => {
    if (!project || !projectTitle.trim()) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ title: projectTitle.trim() })
        .eq('id', project.id);

      if (error) throw error;
      setProject({ ...project, title: projectTitle.trim() });
    } catch (error) {
      console.error('Error updating project title:', error);
      toast.error('Failed to update project title');
    }
    setEditingTitle(false);
  };

  const handleAddSection = async () => {
    if (!project || !newSectionName.trim()) return;

    try {
      const maxOrder = Math.max(...sections.map((s) => s.section_order), -1);
      const { data, error } = await supabase
        .from('sections')
        .insert({
          project_id: project.id,
          title: newSectionName.trim(),
          content: `Add your content here for ${newSectionName.trim()}...`,
          section_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setSections([...sections, data]);
      setActiveSection(data);
      toast.success('Section added');
    } catch (error) {
      console.error('Error adding section:', error);
      toast.error('Failed to add section');
    }

    setAddSectionOpen(false);
    setNewSectionName('');
  };

  const handleDeleteSection = async () => {
    if (!deleteSection) return;

    try {
      const { error } = await supabase
        .from('sections')
        .delete()
        .eq('id', deleteSection.id);

      if (error) throw error;

      const newSections = sections.filter((s) => s.id !== deleteSection.id);
      setSections(newSections);
      
      if (activeSection?.id === deleteSection.id) {
        setActiveSection(newSections[0] || null);
      }
      
      toast.success('Section deleted');
    } catch (error) {
      console.error('Error deleting section:', error);
      toast.error('Failed to delete section');
    }

    setDeleteSection(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);

    const newSections = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({
      ...s,
      section_order: i,
    }));

    setSections(newSections);

    // Update order in database
    try {
      for (const section of newSections) {
        await supabase
          .from('sections')
          .update({ section_order: section.section_order })
          .eq('id', section.id);
      }
    } catch (error) {
      console.error('Error reordering sections:', error);
      toast.error('Failed to save order');
    }
  };

  const handleInsertAIContent = (content: string) => {
    if (!activeSection) return;
    const newContent = activeSection.content + '\n\n' + content;
    handleContentChange(newContent);
    setAskAIOpen(false);
    toast.success('AI content inserted');
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!project) {
    return <Navigate to="/projects" replace />;
  }

  // Build document context for AI
  const documentContext = sections
    .map((s) => `## ${s.title}\n${s.content}`)
    .join('\n\n');

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Projects
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {editingTitle ? (
            <Input
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              onBlur={handleProjectTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleProjectTitleSave()}
              className="h-8 w-64 text-center"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-lg font-semibold hover:underline"
            >
              {project.title}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse-soft">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </span>
          )}
          {!saving && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r bg-sidebar p-4">
          <div className="mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sections
            </h2>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    isActive={activeSection?.id === section.id}
                    onClick={() => setActiveSection(section)}
                    onDelete={() => setDeleteSection(section)}
                    canDelete={section.title !== 'Problem Statement'}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setAddSectionOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Section
          </Button>
        </aside>

        {/* Main Content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {activeSection ? (
            <>
              <div className="border-b p-4">
                <h1 className="text-2xl font-semibold">{activeSection.title}</h1>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <RichTextEditor
                  content={activeSection.content}
                  onChange={handleContentChange}
                />
              </div>
              <div className="border-t p-4">
                <Button onClick={() => setAskAIOpen(true)}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ask AI
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-muted-foreground">Select a section to edit</p>
            </div>
          )}
        </main>
      </div>

      {/* Add Section Dialog */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Section</DialogTitle>
            <DialogDescription>
              Enter a name for your new section
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Section name"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSectionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSection} disabled={!newSectionName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Dialog */}
      <AlertDialog open={!!deleteSection} onOpenChange={() => setDeleteSection(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteSection?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSection}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ask AI Modal */}
      {activeSection && (
        <AskAIModal
          open={askAIOpen}
          onOpenChange={setAskAIOpen}
          documentContext={documentContext}
          currentSection={activeSection.title}
          currentContent={activeSection.content}
          onInsert={handleInsertAIContent}
        />
      )}
    </div>
  );
}
