// @ts-nocheck
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock, LockOpen, RotateCcw, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for the AppInfoPanel component.
 */
interface AppInfoPanelProps {
  isLocked: boolean;
  onToggleLock: () => void;
  onResetLayout: () => void;
  onLoadLayout: () => void;
  className?: string;
}

/**
 * AppInfoPanel displays application info, version, and layout controls.
 * @param props - AppInfoPanelProps
 */
export default function AppInfoPanel({
  isLocked,
  onToggleLock,
  onResetLayout,
  onLoadLayout,
  className
}: AppInfoPanelProps) {
  // Simplified version string (v0.1 instead of Version 0.1.0-beta)
  const versionString = 'v0.1';

  return (
    <div className={cn(
      "h-full w-full bg-gray-900/95 backdrop-blur-sm border border-gray-800/50 rounded-lg",
      "shadow-lg shadow-black/20",
      className
    )}>
      <div className="flex items-center justify-between h-full min-h-[72px] px-6 py-4">
        {/* Logo and Version Section */}
        <div className="flex items-center gap-8 min-w-0">
          <div className="flex items-center">
            <img
              src="/logo.svg"
              alt="1edge"
              className="h-[48px] w-[120px] object-contain brightness-110 contrast-125 scale-110"
            />
          </div>
          <div className="flex items-baseline">
            <span className="text-sm font-medium text-gray-400 tracking-wider uppercase">
              {versionString}
            </span>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <div className="flex items-center gap-1 p-1 bg-gray-800/40 rounded-md border border-gray-700/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onToggleLock}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={cn(
                      "w-8 h-8 p-0 rounded-md transition-all duration-200",
                      "hover:bg-gray-700/60 hover:scale-105",
                      isLocked 
                        ? "bg-green-600/20 text-green-400 border border-green-500/30" 
                        : "text-gray-400 hover:text-gray-200"
                    )}
                  >
                    {isLocked ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <LockOpen className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="left" 
                  className="bg-gray-800 border-gray-700 text-gray-200"
                >
                  {isLocked ? 'Unlock Layout' : 'Lock Layout'}
                </TooltipContent>
              </Tooltip>

              {/* Uncomment if needed
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onLoadLayout}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-8 h-8 p-0 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 hover:scale-105 transition-all duration-200"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="left" 
                  className="bg-gray-800 border-gray-700 text-gray-200"
                >
                  Load custom layout
                </TooltipContent>
              </Tooltip>
              */}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResetLayout}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-8 h-8 p-0 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 hover:scale-105 transition-all duration-200"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent 
                  side="left" 
                  className="bg-gray-800 border-gray-700 text-gray-200"
                >
                  Reset to default layout
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}