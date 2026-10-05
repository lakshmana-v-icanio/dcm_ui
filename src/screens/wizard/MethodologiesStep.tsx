import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';

const SAMPLE_DRAFT = `Rule 1: months 1–12
  IF product = "TERM10" THEN commission = premium × 0.05
Rule 2: months 13–24
  IF product = "TERM10" THEN commission = premium × 0.02`;

const MethodologiesStep = () => {
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div>
      <p className="text-sm text-slate-500 mb-4">
        Describe a commission methodology in plain English. AI will draft the calculation logic — review before saving.
      </p>

      <textarea
        className="w-full rounded-md border border-slate-300 text-sm text-slate-900 px-3 py-2 resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-primary-600 placeholder:text-slate-400 mb-3"
        rows={4}
        placeholder='Example: "Pay 5% of premium for months 1–12, then 2% for months 13–24 for product TERM10."'
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="mb-4">
        <Button
          variant="contained"
          color="primary"
          startIcon={<Sparkles className="w-4 h-4" />}
          disabled={!prompt.trim()}
          onClick={() => setDraft(SAMPLE_DRAFT)}
        >
          Generate Draft
        </Button>
      </div>

      {draft ? (
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Generated draft</p>
          <pre className="text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-4 overflow-auto whitespace-pre-wrap">{draft}</pre>
        </div>
      ) : (
        <Alert severity="info" variant="outlined">
          No draft yet. Enter a methodology and click <strong>Generate Draft</strong>.
        </Alert>
      )}
    </div>
  );
};

export default MethodologiesStep;
