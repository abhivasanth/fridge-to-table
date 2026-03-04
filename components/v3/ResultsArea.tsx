"use client";

type Props = {
  children?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
};

export function ResultsArea({ children, onBack, showBack }: Props) {
  return (
    <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="max-w-[480px] mx-auto px-4 pt-6 pb-4">
        {showBack && onBack && (
          <button
            onClick={onBack}
            className="text-sm text-[#D4622A] mb-6 flex items-center gap-1 hover:underline"
          >
            ← Back
          </button>
        )}
        {children ?? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center pt-8">
            <h1
              className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-[#1A3A2A] leading-tight mb-3"
            >
              What&apos;s in your <em className="text-[#D4602C]">fridge?</em>
            </h1>
            <p className="text-gray-500 text-base max-w-xs">
              Tell us your ingredients — we&apos;ll find you a fun recipe.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
