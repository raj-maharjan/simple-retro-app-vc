import React, { useState } from 'react';
import { AlertTriangle, X, Trash2, Mail } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (sendEmail?: boolean) => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  requireTextConfirmation?: boolean;
  textToConfirm?: string;
  loading?: boolean;
  showEmailCheckbox?: boolean;
  emailCheckboxLabel?: string;
  emailCheckboxDefaultChecked?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  requireTextConfirmation = false,
  textToConfirm = '',
  loading = false,
  showEmailCheckbox = false,
  emailCheckboxLabel = 'Send email summary to participants',
  emailCheckboxDefaultChecked = true,
}: ConfirmationModalProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const [sendEmail, setSendEmail] = useState(emailCheckboxDefaultChecked);

  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      icon: 'text-red-600',
      iconBg: 'bg-red-100',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      border: 'border-red-200',
    },
    warning: {
      icon: 'text-orange-600',
      iconBg: 'bg-orange-100',
      button: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
      border: 'border-orange-200',
    },
    info: {
      icon: 'text-blue-600',
      iconBg: 'bg-blue-100',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      border: 'border-blue-200',
    },
  };

  const styles = typeStyles[type];

  const handleConfirm = () => {
    if (requireTextConfirmation && confirmationText !== textToConfirm) {
      return;
    }
    onConfirm(showEmailCheckbox ? sendEmail : undefined);
  };

  const handleClose = () => {
    setConfirmationText('');
    setSendEmail(emailCheckboxDefaultChecked);
    onClose();
  };

  const isConfirmDisabled = 
    loading || 
    (requireTextConfirmation && confirmationText !== textToConfirm);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 ${styles.iconBg}`}>
              {type === 'danger' ? (
                <Trash2 className={`w-6 h-6 ${styles.icon}`} />
              ) : (
                <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className={`border-l-4 ${styles.border} bg-gray-50 p-4 rounded-r-lg mb-6`}>
            <div className="whitespace-pre-line text-gray-800 leading-relaxed">
              {message}
            </div>
          </div>

          {/* Email Checkbox */}
          {showEmailCheckbox && (
            <div className="mb-6">
              <label className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">
                    {emailCheckboxLabel}
                  </span>
                </div>
              </label>
              <p className="text-xs text-blue-600 mt-2 ml-7">
                {sendEmail 
                  ? "✅ Email summary will be sent to all participants" 
                  : "⚠️ No email will be sent - participants won't receive meeting summary"
                }
              </p>
            </div>
          )}

          {requireTextConfirmation && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                  {textToConfirm}
                </span> to confirm:
              </label>
              <input
                type="text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Type the text above to confirm"
                disabled={loading}
                autoFocus
              />
              {requireTextConfirmation && confirmationText && confirmationText !== textToConfirm && (
                <p className="text-red-600 text-sm mt-2">
                  Text doesn't match. Please type exactly: "{textToConfirm}"
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
              className={`px-6 py-3 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles.button} focus:ring-4 focus:ring-opacity-50`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Processing...
                </div>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}