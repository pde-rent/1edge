import { ButtonHTMLAttributes } from "react";

type ButtonVariant = 'default' | 'danger' | 'warning';

// Define the props interface
interface GlassButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
}

const GlassButton: React.FC<GlassButtonProps> = ({ active, onClick, children, variant = 'default', ...props }) => {
  const variants: Record<ButtonVariant, string>  = {
    default: active 
      ? 'bg-gradient-to-br from-emerald-500/30 via-green-400/25 to-emerald-600/30 hover:from-emerald-500/40 hover:via-green-400/35 hover:to-emerald-600/40 text-emerald-50 border border-emerald-400/40 hover:border-emerald-300/60 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30'
      : 'bg-gradient-to-br from-emerald-900/10 via-green-800/5 to-emerald-700/10 hover:from-emerald-800/20 hover:via-green-700/15 hover:to-emerald-600/20 text-emerald-200 border border-emerald-600/20 hover:border-emerald-500/30 shadow-lg shadow-emerald-900/20',
    danger: active
      ? 'bg-gradient-to-br from-red-500/30 via-red-400/25 to-red-600/30 hover:from-red-500/40 hover:via-red-400/35 hover:to-red-600/40 text-red-50 border border-red-400/40 hover:border-red-300/60 shadow-lg shadow-red-500/25 hover:shadow-red-400/30'
      : 'bg-gradient-to-br from-emerald-900/10 via-green-800/5 to-emerald-700/10 hover:from-emerald-800/20 hover:via-green-700/15 hover:to-emerald-600/20 text-emerald-200 border border-emerald-600/20 hover:border-emerald-500/30 shadow-lg shadow-emerald-900/20',
    warning: active
      ? 'bg-gradient-to-br from-amber-500/30 via-yellow-400/25 to-amber-600/30 hover:from-amber-500/40 hover:via-yellow-400/35 hover:to-amber-600/40 text-amber-50 border border-amber-400/40 hover:border-amber-300/60 shadow-lg shadow-amber-500/25 hover:shadow-amber-400/30'
      : 'bg-gradient-to-br from-emerald-900/10 via-green-800/5 to-emerald-700/10 hover:from-emerald-800/20 hover:via-green-700/15 hover:to-emerald-600/20 text-emerald-200 border border-emerald-600/20 hover:border-emerald-500/30 shadow-lg shadow-emerald-900/20'
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 backdrop-blur-xl transition-all transform hover:scale-[1.02] ${variants[variant]}`}
      {...props}
    >
      {children}
    </button>
  );
};
export default GlassButton;