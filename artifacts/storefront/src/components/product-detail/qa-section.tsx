import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { MessageSquare, Shield, ChevronDown, Send, Loader2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "/api";

interface Answer {
  id: number;
  answerText: string;
  isAdmin: boolean;
  authorName: string;
  createdAt: string;
}

interface Question {
  id: number;
  askerName: string;
  questionText: string;
  createdAt: string;
  answers: Answer[];
}

interface QASectionProps {
  productId: number;
}

export function QASection({ productId }: QASectionProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetch(`${API}/qa/product/${productId}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [productId]);

  const displayed = showAll ? questions : questions.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Questions & Answers
          {questions.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({questions.length})</span>
          )}
        </h2>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          Ask a Question
        </Button>
      </div>

      {showForm && (
        <AskForm
          productId={productId}
          userName={user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : ""}
          userEmail={user?.email ?? ""}
          onSubmitted={() => { setShowForm(false); }}
        />
      )}

      {loading ? (
        <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : questions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>No questions yet. Be the first to ask!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayed.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
          {questions.length > 5 && !showAll && (
            <Button variant="ghost" className="w-full" onClick={() => setShowAll(true)}>
              <ChevronDown className="h-4 w-4 mr-1" /> Show all {questions.length} questions
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question }: { question: Question }) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">Q</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{question.questionText}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Asked by {question.askerName} · {new Date(question.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      {question.answers.map((a) => (
        <div key={a.id} className="ml-9 border-l-2 border-green-200 pl-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">A</span>
            <span className="text-xs font-medium">{a.authorName}</span>
            {a.isAdmin && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
                <Shield className="h-2.5 w-2.5" /> Store Admin
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{a.answerText}</p>
        </div>
      ))}
    </div>
  );
}

interface AskFormProps {
  productId: number;
  userName: string;
  userEmail: string;
  onSubmitted: () => void;
}

function AskForm({ productId, userName, userEmail, onSubmitted }: AskFormProps) {
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const token = useAuthStore((s) => s.token);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.length < 5) {
      toast({ title: "Error", description: "Question must be at least 5 characters", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API}/qa/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({ productId, name, email, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Question Submitted", description: data.message });
      onSubmitted();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit question";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Textarea placeholder="Your question about this product..." value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} required />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
          Submit Question
        </Button>
      </div>
    </form>
  );
}
