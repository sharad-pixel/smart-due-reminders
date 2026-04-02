export function NetSuiteIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#1A1A2E" />
      <path d="M12 14h5l7 12V14h5v20h-5l-7-12v12h-5V14z" fill="#00A1E0" />
      <path d="M31 18h5v12h-5V18z" fill="#00A1E0" />
      <rect x="31" y="14" width="5" height="3" rx="1" fill="#00A1E0" />
    </svg>
  );
}

export function SageIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#00DC00" />
      <path
        d="M14 30c0-1.5 1.2-2.5 3-3.2 2-.7 4.5-1 6-2.3.8-.7 1.2-1.6 1.2-2.7 0-2-1.6-3.3-3.8-3.3-2.4 0-4 1.5-4.2 3.8h-3.4c.3-4 3.2-6.8 7.6-6.8 4.2 0 7.2 2.5 7.2 6 0 2.2-1 3.8-2.8 5-1.6 1-3.6 1.4-5.2 2-.8.3-1.4.8-1.4 1.5v.5h9.2V34H14v-4z"
        fill="white"
      />
    </svg>
  );
}
