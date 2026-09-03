import React, { useEffect, useRef } from 'react';
import './LogoutConfirmModal.css';

/**
 * Premium Logout Confirmation Modal
 * Reusable across User/Employee, HR, Sales, BD, Finance, Admin, and Super Admin dashboards.
 *
 * Props:
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Called when user cancels or closes the modal
 * @param {function} onConfirm - Called when user confirms logout
 */
export default function LogoutConfirmModal({ isOpen, onClose, onConfirm }) {
  const cancelBtnRef = useRef(null);

  // Focus the Cancel button on open and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Focus cancel button for safe keyboard navigation
    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="logout-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="logout-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
        aria-describedby="logout-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close icon button */}
        <button
          type="button"
          className="logout-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Icon Badge */}
        <div className="logout-modal-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
        </div>

        {/* Content */}
        <h3 id="logout-modal-title" className="logout-modal-title">
          Are you sure you want to logout?
        </h3>
        <p id="logout-modal-desc" className="logout-modal-desc">
          You will be signed out of your CRM workspace and returned to the sign-in page.
        </p>

        {/* Action Buttons */}
        <div className="logout-modal-actions">
          <button
            type="button"
            ref={cancelBtnRef}
            className="logout-modal-btn logout-modal-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="logout-modal-btn logout-modal-btn-confirm"
            onClick={onConfirm}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
