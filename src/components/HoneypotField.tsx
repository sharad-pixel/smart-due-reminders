import React from 'react';

interface HoneypotFieldProps {
  name?: string;
  tabIndex?: number;
}

/**
 * Honeypot field component for bot detection
 * This field should be invisible to real users but visible to bots
 * If the field is filled, it indicates bot behavior
 */
export const HoneypotField: React.FC<HoneypotFieldProps> = ({ 
  name = 'website',
  tabIndex = -1
}) => {
  return (
    <div 
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        opacity: 0,
        height: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <label htmlFor={name}>
        Leave this field empty
      </label>
      <input
        type="text"
        id={name}
        name={name}
        autoComplete="off"
        tabIndex={tabIndex}
        aria-label="Leave this field empty if you are a human"
      />
    </div>
  );
};

/**
 * Check if honeypot was triggered (field was filled)
 */
export function isHoneypotTriggered(value: string | undefined | null): boolean {
  return !!value && value.trim().length > 0;
}

export default HoneypotField;
