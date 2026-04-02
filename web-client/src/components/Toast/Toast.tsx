"use client";

import { useEffect } from "react";

import styles from "./Toast.module.scss";

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className={styles.toast}>
      <span>{message}</span>
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
