import React, { useEffect, useRef, useState } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
};

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children }) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "auto";
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.55)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={dialogRef}
        style={{
          background: "white",
          padding: 24,
          borderRadius: 10,
          width: 420,
        }}
      >
        <h3 id="modal-title">{title}</h3>
        <div>{children}</div>
        <button ref={closeBtnRef} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

const Practice4ModalRefEffect: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    try {
      const timer = setTimeout(() => {
        setLoading(false);
      }, 2000);
    } catch (e) {
      setError("Failed to load content");
    }

    return () => clearTimeout(timer);
  }, [open]);

  return (
    <section>
      <h2>Modal Practice</h2>
      <button onClick={() => setOpen(true)}>Open Modal</button>
      <Modal open={open} title="Interview Modal" onClose={() => setOpen(false)}>
        {loading ? (
          <p>Loading...</p>
        ) : error ? (
          <p role="alert">{error}</p>
        ) : (
          <>
            <p>Practice: useRef + useEffect + accessibility behavior.</p>
            <input placeholder="Focusable input" />
          </>
        )}
      </Modal>
    </section>
  );
};

export default Practice4ModalRefEffect;
