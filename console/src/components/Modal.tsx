"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import styles from "./Modal.module.css";

interface ModalState {
  type: "alert" | "confirm" | "prompt";
  title?: string;
  message: string;
  placeholder?: string;
  inputValue?: string;
  resolve: (value: any) => void;
}

interface ModalContextValue {
  alert: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string, title?: string) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const alertFn = useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      setModal({ type: "alert", title, message, resolve });
    });
  }, []);

  const confirmFn = useCallback((message: string, title?: string) => {
    return new Promise<boolean>((resolve) => {
      setModal({ type: "confirm", title, message, resolve });
    });
  }, []);

  const promptFn = useCallback((message: string, defaultValue?: string, title?: string) => {
    return new Promise<string | null>((resolve) => {
      setModal({ type: "prompt", title, message, inputValue: defaultValue || "", resolve });
    });
  }, []);

  const close = (value: any) => {
    modal?.resolve(value);
    setModal(null);
  };

  if (!modal) {
    return (
      <ModalContext.Provider value={{ alert: alertFn, confirm: confirmFn, prompt: promptFn }}>
        {children}
      </ModalContext.Provider>
    );
  }

  return (
    <ModalContext.Provider value={{ alert: alertFn, confirm: confirmFn, prompt: promptFn }}>
      {children}
      <div className={styles.overlay} onClick={() => close(modal.type === "alert" ? undefined : modal.type === "confirm" ? false : null)}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          {modal.title && <div className={styles.title}>{modal.title}</div>}
          <div className={styles.message}>{modal.message}</div>
          {modal.type === "prompt" && (
            <input
              className={styles.input}
              type="text"
              placeholder={modal.placeholder}
              defaultValue={modal.inputValue}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") close((e.target as HTMLInputElement).value);
                if (e.key === "Escape") close(null);
              }}
              ref={(el) => el?.focus()}
            />
          )}
          <div className={styles.actions}>
            {modal.type === "confirm" && (
              <button className={styles.cancelBtn} onClick={() => close(false)}>Cancel</button>
            )}
            {modal.type === "prompt" && (
              <button className={styles.cancelBtn} onClick={() => close(null)}>Cancel</button>
            )}
            <button
              className={modal.type === "confirm" || modal.type === "prompt" ? styles.dangerBtn : styles.okBtn}
              onClick={() => {
                if (modal.type === "alert") close(undefined);
                else if (modal.type === "confirm") close(true);
                else {
                  const input = document.querySelector(`.${styles.input}`) as HTMLInputElement;
                  close(input?.value ?? null);
                }
              }}
            >
              {modal.type === "alert" ? "OK" : modal.type === "confirm" ? "Confirm" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </ModalContext.Provider>
  );
}
