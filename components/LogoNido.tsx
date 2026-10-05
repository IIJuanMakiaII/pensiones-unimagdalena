interface Props {
  className?: string;
}

export default function LogoNido({ className = "h-8" }: Props) {
  return (
    <span className={`inline-flex select-none items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto shrink-0 text-airbnb-rausch"
        fill="none"
        stroke="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 44 L50 14 L88 44"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 58 C20 84 36 94 50 94 C64 94 80 84 80 58"
          strokeWidth="7.5"
          strokeLinecap="round"
        />
        <path
          d="M34 58 C34 44 42 36 44 46 L56 68 C58 76 66 70 66 58"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="flex items-baseline text-2xl font-black tracking-tight text-airbnb-charcoal">
        nido<span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-airbnb-rausch" />
      </span>
    </span>
  );
}