import { Info } from "lucide-react";
import { FieldError } from "react-hook-form";

interface InputFieldProps {
  label: string;
  error?: FieldError | boolean;
  children: React.ReactNode;
  info?: boolean;
}

const InputField: React.FC<InputFieldProps>  = ({ label, error=false, children, info = false }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      {info && <Info className="w-4 h-4 text-gray-400" />}
    </div>
    {children}
    {error && <div className="text-xs text-red-400 mt-1">{error.message}</div>}
  </div>
);
export default InputField;