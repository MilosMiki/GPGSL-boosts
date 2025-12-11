// src/components/Popup.tsx
import React, { useState, useEffect } from "react";

interface TooltipProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  triggerElement?: HTMLElement | null;
}

export default function Tooltip({
  isOpen,
  message,
  triggerElement,
  onClose,
}: TooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (isOpen && triggerElement) {
      const rect = triggerElement.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });

      // Close tooltip when clicking anywhere else
      const handleClickOutside = (e: MouseEvent) => {
        if (triggerElement && !triggerElement.contains(e.target as Node)) {
          onClose();
        }
      };

      document.addEventListener("click", handleClickOutside);
      return () => {
        document.removeEventListener("click", handleClickOutside);
      };
    }
  }, [isOpen, triggerElement, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="tooltip"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <p>{message}</p>
    </div>
  );
}
