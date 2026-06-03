import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { CiLintResult } from '@/types/gitlab';

interface Props {
  projectId: number;
  yaml: string;
}

type State = 'idle' | 'loading' | 'done' | 'error';

/** Quick client-side check for the `gl_preview` cookie. */
function isPreviewMode(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('gl_preview=1'));
}

export function CiLintValidator({ projectId, yaml }: Props) {
  const [state, setState] = useState<State>('idle');
  const [result, setResult] = useState<CiLintResult | null>(null);
  const preview = isPreviewMode();

  async function validate() {
    setState('loading');
    try {
      const res = await fetch('/api/ci-lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, content: yaml }),
      });
      if (!res.ok) {
        setState('error');
        toast.error('CI Lint request failed.');
        return;
      }
      const data = await res.json();
      // Defensive normalisation — API always returns these but guard anyway
      setResult({
        valid: data.valid ?? false,
        errors: data.errors ?? [],
        warnings: data.warnings ?? [],
      });
      setState('done');
    } catch {
      setState('error');
      toast.error('CI Lint request failed.');
    }
  }

  return (
    <div className="border-t border-white/10 px-4 py-3 space-y-2">
      <button
        onClick={validate}
        disabled={state === 'loading' || preview}
        title={preview ? 'Sign in to validate CI config' : undefined}
        className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 text-xs font-medium text-white transition-colors"
      >
        {preview ? (
          <Lock className="h-3.5 w-3.5" />
        ) : state === 'loading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5" />
        )}
        Validate CI Config
      </button>

      {preview && (
        <p className="text-xs text-white/50">
          Validation calls the GitLab CI Lint API which requires authentication —
          <a
            href="/auth/exit-preview"
            className="text-indigo-300 underline hover:text-indigo-200 ml-1"
          >
            sign in
          </a>{' '}
          to enable.
        </p>
      )}

      {state === 'error' && <p className="text-xs text-red-400">Validation request failed.</p>}

      {state === 'done' && result && (
        <div
          className={`rounded-md border px-3 py-2 text-xs space-y-1 ${
            result.valid
              ? 'border-green-500/40 bg-green-500/10 text-green-300'
              : 'border-red-500/40 bg-red-500/10 text-red-300'
          }`}
        >
          <div className="flex items-center gap-1.5 font-semibold">
            {result.valid ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {result.valid ? 'Configuration is valid' : 'Configuration is invalid'}
          </div>

          {result.errors.map((e, i) => (
            <p key={i} className="flex gap-1 text-red-300">
              <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
              {e}
            </p>
          ))}

          {result.warnings.map((w, i) => (
            <p key={i} className="flex gap-1 text-yellow-300">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
