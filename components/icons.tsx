interface IconProps {
  size?: number;
  className?: string;
}

function base(paths: string) {
  return function Icon({ size = 18, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: paths }}
      />
    );
  };
}

export const IconDocument = base(
  '<path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/><path d="M8 12h8"/><path d="M8 16h5"/>'
);

export const IconUser = base(
  '<circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>'
);

export const IconGrid = base(
  '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>'
);

export const IconFlask = base(
  '<path d="M9 3h6"/><path d="M10 3v6l-5.3 9.2A1.4 1.4 0 0 0 5.9 20.4h12.2a1.4 1.4 0 0 0 1.2-2.2L14 9V3"/><path d="M7.7 14.5h8.6"/>'
);

export const IconCalculator = base(
  '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><circle cx="8.3" cy="12" r="0.9"/><circle cx="12" cy="12" r="0.9"/><circle cx="15.7" cy="12" r="0.9"/><circle cx="8.3" cy="16" r="0.9"/><circle cx="12" cy="16" r="0.9"/><circle cx="15.7" cy="16" r="0.9"/>'
);

export const IconBarChart = base(
  '<path d="M4 20V11"/><path d="M12 20V4"/><path d="M20 20v-6"/><path d="M2 20h20"/>'
);

export const IconBuilding = base(
  '<rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>'
);

export const IconSpark = base('<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10.5H13z"/>');

export const IconMenu = base('<path d="M4 7h16M4 12h16M4 17h16"/>');

export const IconClose = base('<path d="M6 6l12 12M18 6L6 18"/>');

export const IconClock = base('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');

export const IconChevronDown = base('<path d="M6 9l6 6 6-6"/>');

export const IconHome = base(
  '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9"/>'
);

export const IconArrowLeft = base('<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/>');

export const IconMic = base(
  '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/><path d="M8 22h8"/>'
);

export const IconFolder = base(
  '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z"/>'
);

export const IconActivity = base(
  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'
);

export const IconPaperclip = base(
  '<path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L10.5 17.66a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'
);

export const IconWhatsapp = base(
  '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>'
);

export const IconMail = base('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>');

export const IconChecklist = base(
  '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 9l1.5 1.5L11 8"/><path d="M14 9h5"/><path d="M7 15.5l1.5 1.5L11 14.5"/><path d="M14 16h5"/>'
);

export function IconGmail({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
      />
    </svg>
  );
}

export const IconCalendar = base(
  '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>'
);

export const IconBox = base(
  '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5"/><path d="M12 12v9"/>'
);

export const IconTruck = base(
  '<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h4l3.5 3.5v3h-7.5"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'
);

export const IconBell = base(
  '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>'
);

export const IconCheck = base('<path d="M5 12.5 10 17.5 19.5 7"/>');

export const IconUsers = base(
  '<circle cx="9" cy="8" r="3"/><path d="M3 19.5c0-3.2 2.7-5.5 6-5.5s6 2.3 6 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.6.2 4.5 2.1 4.5 4.8"/>'
);

export const IconSettings = base(
  '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12H5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>'
);

export const IconAlert = base(
  '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5"/><path d="M12 17.3v.2"/>'
);

export const IconQr = base(
  '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h3v3h-3zM18 18h2.5M20.5 14v2M14 20.5h2"/>'
);
