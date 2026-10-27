import React, { useState } from 'react';
import { Wheat, PenLine, Check, ArrowRight } from 'lucide-react';
import { apiFetch, getStoredUser } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui';
import SignaturePad from './SignaturePad';

/**
 * Shown once, the first time a trader signs in.
 *
 * Two details are needed before the first bill can be printed properly: the
 * name that signs the bill, and the signature image itself. Previously both
 * were buried in Settings, so a trader's first invoices went out unsigned and
 * with a blank signatory line, and most never found the setting at all.
 *
 * It can be skipped. The choice is remembered per account so it does not ask
 * again on every load, and the same fields remain editable in Settings.
 */

const SKIP_KEY = 'adatya_setup_skipped';

export function hasCompletedSetup(profile: { signatureName?: string; signatureData?: string } | null): boolean {
  if (!profile) return true; // Nothing loaded yet; do not flash the dialog.
  // The name is what prints above the signature line, so that alone counts as
  // set up. Requiring the signature image too meant a trader who chose "save
  // name only" was asked again on every single load.
  return !!(profile.signatureName && profile.signatureName.trim());
}

export function wasSetupSkipped(): boolean {
  try {
    const user = getStoredUser();
    return localStorage.getItem(`${SKIP_KEY}_${user?.id ?? 'anon'}`) === 'true';
  } catch {
    return false;
  }
}

function rememberSkip() {
  try {
    const user = getStoredUser();
    localStorage.setItem(`${SKIP_KEY}_${user?.id ?? 'anon'}`, 'true');
  } catch {
    /* storage unavailable; it will simply ask again next time */
  }
}

export default function FirstRunSetup({
  profile,
  onDone,
}: {
  profile: any;
  onDone: () => void;
}) {
  const user = getStoredUser();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState<string>(profile?.signatureName || user?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (signatureData: string, signatureType: string, signatureName: string) => {
    const finalName = (signatureName || name).trim();
    if (!finalName) {
      setError('Please enter the name that signs your bills');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureName: finalName,
          signatureData: signatureData || null,
          signatureType: signatureType || 'upload',
          proprietorName: finalName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Could not save. Please try again.');
        return;
      }
      toast.success('Your bills will now carry your name and signature.');
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Could not reach the server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    rememberSkip();
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/50 p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-title"
        className="flex max-h-full w-full max-w-xl flex-col overflow-y-auto bg-surface shadow-overlay sm:rounded-card"
      >
        <div className="border-b border-line bg-brand-950 px-6 py-5 text-ink-inverted">
          <div className="mb-2 flex items-center gap-2">
            <Wheat className="h-5 w-5 text-brand-300" aria-hidden="true" />
            <span className="text-2xs font-bold tracking-wider uppercase text-brand-200">
              Step {step} of 2
            </span>
          </div>
          <h2 id="setup-title" className="font-serif text-xl font-bold">
            Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h2>
          <p className="mt-1 text-sm text-brand-100">
            Set up the signature that appears on every bill you print. This takes a moment and you
            can change it later in Settings.
          </p>
        </div>

        {error && (
          <p className="border-b border-line bg-due-bg px-6 py-2.5 text-sm font-medium text-due-fg" role="alert">
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="space-y-5 px-6 py-6">
            <div className="space-y-1.5">
              <label htmlFor="setup-name" className="block text-2xs font-semibold tracking-wide text-ink uppercase">
                Name on your bills <span className="text-due-fg">*</span>
              </label>
              <Input
                id="setup-name"
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Ramesh Patil"
                className="h-11"
              />
              <p className="text-2xs text-ink-subtle">
                This is printed above the signature line on every purchase bill.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={skip} disabled={saving}>
                Skip for now
              </Button>
              <Button
                onClick={() => {
                  if (!name.trim()) {
                    setError('Please enter the name that signs your bills');
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
              >
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 px-6 py-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <PenLine className="h-4 w-4 text-brand-700" aria-hidden="true" />
              Add your signature
            </div>

            <SignaturePad
              initialSignature={profile?.signatureData || null}
              initialName={name}
              onSave={save}
            />

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={saving}>
                Back
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" onClick={skip} disabled={saving}>
                  Skip for now
                </Button>
                <Button onClick={() => save('', 'upload', name)} disabled={saving}>
                  <Check className="h-4 w-4" /> {saving ? 'Saving…' : 'Save name only'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
