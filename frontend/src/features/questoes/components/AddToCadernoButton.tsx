import { Plus } from "lucide-react";

type AddToCadernoButtonProps = {
  onClick: () => void;
  iconOnly?: boolean;
  className?: string;
};

export default function AddToCadernoButton({
  onClick,
  iconOnly = false,
  className = "",
}: AddToCadernoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Adicionar ao caderno"
      aria-label="Adicionar ao caderno"
      className={className}
    >
      <Plus size={16} />
      {!iconOnly && <span>Adicionar ao caderno</span>}
    </button>
  );
}

