"use client";
import { IngredientInput } from "@/components/IngredientInput";

type Props = {
  onSubmit: (ingredients: string[], imageBase64?: string) => void;
  isLoading: boolean;
  disabled: boolean;
  children?: React.ReactNode;
};

export function InputArea({ onSubmit, isLoading, disabled, children }: Props) {
  return (
    <div
      className="flex-shrink-0 z-50"
      style={{
        background: "rgba(250, 247, 242, 0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderTop: "1px solid rgba(45, 74, 46, 0.06)",
      }}
    >
      <div className="max-w-[480px] mx-auto px-4 pt-3 pb-4 space-y-3">
        <IngredientInput onSubmit={onSubmit} isLoading={isLoading} disabled={disabled} />
        {children}
      </div>
    </div>
  );
}
