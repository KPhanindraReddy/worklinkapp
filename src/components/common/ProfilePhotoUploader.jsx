import { Camera, LoaderCircle, Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import { ProfileAvatar } from './ProfileAvatar';
import { uploadProfilePhoto } from '../../services/storageService';
import { updateUserProfilePhoto } from '../../services/userService';

export const ProfilePhotoUploader = ({
  uid,
  role,
  value,
  fullName,
  disabled = false,
  compact = false,
  persistOnUpload = false,
  avatarClassName = '',
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
      if (persistOnUpload) {
        await updateUserProfilePhoto(uid, role, downloadUrl);
      }
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
    <div
      className={
        compact
          ? 'relative inline-flex'
          : 'flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3'
      }
    >
      <ProfileAvatar
        src={photoUrl}
        name={fullName}
        className={`${compact ? 'h-16 w-16 rounded-2xl shadow-sm' : 'h-16 w-16 rounded-2xl shadow-sm'} ${avatarClassName}`.trim()}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
      />
      {!compact ? (
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">Profile photo</p>
          <p className="mt-1 text-xs text-slate-500">Small image saved in Firebase Storage.</p>
        </div>
      ) : null}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled || uploading}
        onChange={handleFileChange}
      />
      {compact ? (
        <label
          htmlFor={inputId}
          className={`absolute -bottom-1 -right-1 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.24)] transition hover:bg-brand-600 ${
            disabled || uploading ? 'pointer-events-none opacity-60' : ''
          }`}
          aria-label={uploading ? 'Uploading profile photo' : 'Change profile photo'}
          title={uploading ? 'Uploading profile photo' : 'Change profile photo'}
        >
          {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <Pencil size={14} />}
        </label>
      ) : (
        <label
          htmlFor={inputId}
          className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:border-brand-300 hover:text-brand-700 ${
            disabled || uploading ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Camera size={15} />}
          {uploading ? 'Uploading' : 'Change'}
        </label>
      )}
    </div>
  );
};
