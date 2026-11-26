import type { MouseEvent, ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={stop}>
        <div className="modal-card__header">
          <h2 className="modal-card__title">{title}</h2>
          <button className="modal-card__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );
}
