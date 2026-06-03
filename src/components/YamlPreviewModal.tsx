import { useState, useEffect, lazy, Suspense } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { CiLintValidator } from '@/components/CiLintValidator';

// Both the highlighter and its style live in the syntax-highlighter chunk
// (~1.7 MB). Keep both imports inside the dynamic boundary so the chunk is
// only fetched when a YAML preview is opened — pulling the style eagerly
// would re-pin the chunk to the parent bundle.
const HighlightedYaml = lazy(async () => {
  const [{ Prism }, { vscDarkPlus }] = await Promise.all([
    import('react-syntax-highlighter'),
    import('react-syntax-highlighter/dist/cjs/styles/prism'),
  ]);
  function HighlightedYaml({ children }: { children: string }) {
    return (
      <Prism
        language="yaml"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.75rem',
          background: 'transparent',
        }}
        showLineNumbers
      >
        {children}
      </Prism>
    );
  }
  return { default: HighlightedYaml };
});

interface Props {
  projectId: number;
  projectName: string;
  open: boolean;
  onClose: () => void;
}

export function YamlPreviewModal({ projectId, projectName, open, onClose }: Props) {
  const [yaml, setYaml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYaml(null);
    setError(false);
    fetch(`/api/ci-yaml?projectId=${projectId}`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then(setYaml)
      .catch(() => setError(true));
  }, [open, projectId]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-lg bg-[#1e1e1e] shadow-2xl focus:outline-none"
          aria-describedby="yaml-desc"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0">
            <div>
              <Dialog.Title className="text-sm font-semibold text-white">
                .gitlab-ci.yml — {projectName}
              </Dialog.Title>
              <Dialog.Description id="yaml-desc" className="text-xs text-white/50">
                CI/CD configuration preview
              </Dialog.Description>
            </div>
            <Dialog.Close className="text-white/50 hover:text-white">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {error ? (
              <p className="p-6 text-center text-sm text-red-400">
                .gitlab-ci.yml not found or access denied.
              </p>
            ) : yaml === null ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-3 animate-pulse rounded bg-white/10"
                    style={{ width: `${30 + ((i * 7) % 60)}%` }}
                  />
                ))}
              </div>
            ) : (
              <Suspense fallback={<div className="p-4 h-32 animate-pulse bg-white/5 rounded" />}>
                <HighlightedYaml>{yaml}</HighlightedYaml>
              </Suspense>
            )}
          </div>

          {/* CI Lint validator — only shown once YAML is loaded */}
          {yaml && <CiLintValidator projectId={projectId} yaml={yaml} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
