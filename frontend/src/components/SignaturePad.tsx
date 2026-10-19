import React, { useRef, useState } from 'react';
import { Upload, Trash2, Check, Image as ImageIcon, UserCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface SignaturePadProps {
  initialSignature?: string | null;
  initialType?: string;
  initialName?: string;
  onSave: (signatureData: string, type: string, signatureName: string) => void;
}

export default function SignaturePad({
  initialSignature,
  initialName = 'M. V. Bodhale',
  onSave
}: SignaturePadProps) {
  const [signatureName, setSignatureName] = useState(initialName || '');
  const [currentSignature, setCurrentSignature] = useState<string | null>(initialSignature || null);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, or WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCurrentSignature(result);
      setIsSaved(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setCurrentSignature(null);
    setIsSaved(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = () => {
    onSave(currentSignature || '', 'upload', signatureName);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Signatory Person Name */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            Signatory Person Name (स्वाक्षरी व्यक्तीचे नाव)
          </label>
          <Input
            value={signatureName}
            onChange={(e) => {
              setSignatureName(e.target.value);
              setIsSaved(false);
            }}
            placeholder="e.g. M. V. Bodhale / Maroti V Bodhale"
            className="h-11 font-medium bg-white"
          />
          <p className="text-[11px] text-slate-500">
            This name will be printed below the signature on all purchase vouchers.
          </p>
        </div>

        {/* Signature Image Upload Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Upload className="w-4 h-4 text-emerald-600" />
            Upload Official Signature (स्वाक्षरी अपलोड करा)
          </label>

          {currentSignature ? (
            <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-4 bg-slate-50/60 flex flex-col items-center justify-center min-h-[140px]">
              <img
                src={currentSignature}
                alt="Uploaded Signature"
                className="max-h-24 max-w-full object-contain filter contrast-125 my-1"
              />
              <div className="flex items-center gap-2 mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs h-8 bg-white"
                >
                  <Upload className="w-3.5 h-3.5 mr-1" /> Replace Image
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRemove}
                  className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-6 bg-slate-50/50 hover:bg-emerald-50/20 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[140px] text-center"
            >
              <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-600 mb-2">
                <ImageIcon className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-xs font-bold text-slate-800">
                Click to Upload Signature Image
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                PNG, JPG or WEBP (Clear image on white paper recommended)
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button & Status */}
      <div className="pt-2 flex items-center justify-between border-t border-slate-200">
        <div className="text-xs text-slate-500">
          {isSaved ? (
            <span className="text-emerald-700 font-bold flex items-center gap-1.5 animate-in fade-in">
              <Check className="w-4 h-4 stroke-[3]" /> Signature saved! Active on all bills.
            </span>
          ) : (
            <span>Click save to apply to all bills</span>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSave}
          className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 shadow-xs"
        >
          Save Signature Details
        </Button>
      </div>
    </div>
  );
}
