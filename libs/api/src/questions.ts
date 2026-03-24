export interface Question {
  id: number;
  item_bank_id: number | null;
  owner_id: number;
  type: string;
  name: string;
  text: string | null;
  mark: number;
  status: 'draft' | 'in_review' | 'published';
  content: Record<string, unknown>;
  rejection_note: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
  tags?: { id: number; name: string; slug: string }[];
}

export async function publishQuestion(id: number, notes?: string): Promise<void> {
  const response = await fetch(`/questions/${id}/publish`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_notes: notes }),
  });
  if (!response.ok) {
    throw new Error(`Failed to publish question: ${response.status}`);
  }
}

export async function rejectQuestion(id: number, reason: string): Promise<void> {
  const response = await fetch(`/questions/${id}/reject`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_notes: reason }),
  });
  if (!response.ok) {
    throw new Error(`Failed to reject question: ${response.status}`);
  }
}
