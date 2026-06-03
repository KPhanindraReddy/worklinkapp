import { Camera, LoaderCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { uploadProfilePhoto } from '../../services/storageService';

export const ProfilePhotoUploader = ({
  uid,
  role,
  value,
  fullName,
  disabled = false,
  onChange,
  onError
}) => {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const photoUrl = previewUrl || value || '';

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setUploading(true);

    try {
      const downloadUrl = await uploadProfilePhoto({ uid, role, file });
      setPreviewUrl(downloadUrl);
      onChange?.(downloadUrl);
    } catch (error) {
      setPreviewUrl(value || '');
      onError?.(error);
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
      <ProfileAvatar
        src={photoUrl}
        name={fullName}
        className="h-16 w-16 rounded-2xl shadow-sm"
        loading="eager"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-950">Profile photo</p>
        <p className="mt-1 text-xs text-slate-500">Small image saved in Firebase Storage.</p>
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={handleFileChange}
      />
      <label
        htmlFor={inputId}
        className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:border-brand-300 hover:text-brand-700 ${
          disabled || uploading ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Camera size={15} />}
        {uploading ? 'Uploading' : 'Change'}
      </label>
    </div>
  );
};
