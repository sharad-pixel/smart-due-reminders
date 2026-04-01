export function GoogleDriveIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066DA"/>
      <path d="M43.65 25.15L29.9 1.35c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.2c-.8 1.4-1.2 2.95-1.2 4.5h27.5l16.15-27.55z" fill="#00AC47"/>
      <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.7c.8-1.4 1.2-2.95 1.2-4.5H59.8l6.85 12.5 6.9 11.1z" fill="#EA4335"/>
      <path d="M43.65 25.15L57.4 1.35C56.05.55 54.5 0 52.85 0H34.45c-1.65 0-3.2.55-4.55 1.35l13.75 23.8z" fill="#00832D"/>
      <path d="M59.8 53.2h27.5c0-1.55-.4-3.1-1.2-4.5L60.75 4.65c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25.15 59.8 53.2z" fill="#2684FC"/>
      <path d="M43.65 25.15L27.5 53.2l16.15 27.55L59.8 53.2 43.65 25.15z" fill="#FFBA00" fillOpacity="0"/>
      <path d="M27.5 53.2L13.75 76.8c1.35.8 2.9 1.2 4.55 1.2h50.7c1.65 0 3.2-.45 4.55-1.2L59.8 53.2H27.5z" fill="#FFBA00"/>
    </svg>
  );
}

export function GoogleSheetsIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path d="M37 45H11c-1.657 0-3-1.343-3-3V6c0-1.657 1.343-3 3-3h19l10 10v29c0 1.657-1.343 3-3 3z" fill="#43A047"/>
      <path d="M40 13H30V3l10 10z" fill="#C8E6C9"/>
      <path d="M30 3v10h10L30 3z" fill="#2E7D32" opacity=".3"/>
      <path d="M15 23h18v14H15V23z" fill="#E8F5E9"/>
      <path d="M15 23h18v3H15v-3zm0 5h18v3H15v-3zm0 5h18v3H15v-3z" fill="#43A047" opacity=".4"/>
      <path d="M23 23v14h1V23h-1z" fill="#43A047" opacity=".4"/>
    </svg>
  );
}
