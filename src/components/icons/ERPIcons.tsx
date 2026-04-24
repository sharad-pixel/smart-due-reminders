export function NetSuiteIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      {/* Oracle NetSuite brand colors */}
      <rect width="48" height="48" rx="8" fill="#1B1B1B" />
      {/* Stylized "N" mark */}
      <path d="M12 34V14h4.5l9 13.5V14H30v20h-4.5l-9-13.5V34H12z" fill="#FFFFFF" />
      {/* Oracle red accent bar */}
      <rect x="33" y="14" width="4" height="20" rx="1" fill="#C74634" />
    </svg>
  );
}

export function SageIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      {/* Sage brand green */}
      <rect width="48" height="48" rx="8" fill="#00B140" />
      {/* Sage leaf/circle mark */}
      <circle cx="24" cy="24" r="12" fill="none" stroke="white" strokeWidth="2.5" />
      {/* Leaf shape inside */}
      <path
        d="M18 28c0-6 4-10 10-12-2 4-3 8-2 12-2 1-5 1-8 0z"
        fill="white"
        opacity="0.95"
      />
      <path
        d="M20 26c1-4 3-7 6-9"
        fill="none"
        stroke="#00B140"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function OracleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      {/* Oracle brand red background */}
      <rect width="48" height="48" rx="8" fill="#F80000" />
      {/* Stylized "O" mark — Oracle's signature oval ring */}
      <ellipse
        cx="24"
        cy="24"
        rx="13"
        ry="8"
        fill="none"
        stroke="white"
        strokeWidth="3.2"
      />
    </svg>
  );
}

export function DnBIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      {/* D&B brand navy */}
      <rect width="48" height="48" rx="8" fill="#003E7E" />
      {/* "D&B" wordmark */}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fill="white"
        fontSize="16"
        fontWeight="bold"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="-0.5"
      >
        D&amp;B
      </text>
    </svg>
  );
}
