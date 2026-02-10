import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Copy, Plus, Send } from 'lucide-react';
import { toast } from 'sonner';

interface AskAIModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentContext: string;
  currentSection: string;
  currentContent: string;
  onInsert: (content: string) => void;
}

export default function AskAIModal({
  open,
  onOpenChange,
  documentContext,
  currentSection,
  currentContent,
  onInsert,
}: AskAIModalProps) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    setResponse('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Please log in to use Ask AI');
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            documentContext,
            currentSection,
            currentContent,
            userQuestion: question,
          }),
        }
      );

      if (!res.ok) {
        if (res.status === 429) {
          toast.error('Rate limit exceeded. Please try again in a moment.');
          return;
        }
        if (res.status === 402) {
          toast.error('AI credits exhausted. Please add credits to continue.');
          return;
        }
        throw new Error('Failed to get AI response');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setResponse(fullResponse);
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Ask AI error:', error);
      toast.error('Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    toast.success('Copied to clipboard');
  };

  const handleInsert = () => {
    onInsert(response);
    handleReset();
  };

  const handleReset = () => {
    setQuestion('');
    setResponse('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ask AI</DialogTitle>
          <DialogDescription>
            Get AI assistance with your "{currentSection}" section
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              placeholder="Ask AI to help with this section... (e.g., 'Expand on user pain points', 'Suggest persona characteristics', 'Draft this section')"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isLoading}
              rows={2}
            />
            <Button onClick={handleSubmit} disabled={!question.trim() || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {(response || isLoading) && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <ScrollArea className="max-h-64">
                {isLoading && !response && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Thinking...
                  </div>
                )}
                {response && (
                  <div className="whitespace-pre-wrap text-sm">{response}</div>
                )}
              </ScrollArea>
            </div>
          )}

          {response && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button onClick={handleInsert}>
                <Plus className="mr-2 h-4 w-4" />
                Insert into document
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                Ask another question
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
