"use client";

type CustomChef = {
  channelId: string;
  channelName: string;
  channelThumbnail: string;
};

type Props = {
  chef: CustomChef;
  onRemove?: () => void;
  onAdd?: () => void;
};

export function CustomChefCard({ chef, onRemove, onAdd }: Props) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-200">
      <img
        src={chef.channelThumbnail}
        alt={chef.channelName}
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />
      <span className="flex-1 text-sm font-semibold text-[#1A3A2A] truncate">
        {chef.channelName}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 text-lg leading-none"
          aria-label={`Remove ${chef.channelName}`}
        >
          ✕
        </button>
      )}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="text-[#D4622A] text-sm font-semibold flex-shrink-0 hover:underline"
          aria-label={`Add ${chef.channelName}`}
        >
          Add
        </button>
      )}
    </div>
  );
}
