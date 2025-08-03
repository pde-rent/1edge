import { Controller } from "react-hook-form";

interface OrderDirectionToggleProps {
  control: any;
  name?: string;
}

const OrderDirectionToggle: React.FC<OrderDirectionToggleProps> = ({ 
  control, 
  name = "orderDirection" 
}) => {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue="buy"
      render={({ field }) => (
        <div className="flex rounded-lg bg-card border border-primary/25 p-1">
          <button
            type="button"
            onClick={() => field.onChange("buy")}
            className={`flex-1 py-2 px-4 text-sm font-bold rounded-md transition-all duration-200 ${
              field.value === "buy"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => field.onChange("sell")}
            className={`flex-1 py-2 px-4 text-sm font-bold rounded-md transition-all duration-200 ${
              field.value === "sell"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sell
          </button>
        </div>
      )}
    />
  );
};

export default OrderDirectionToggle;