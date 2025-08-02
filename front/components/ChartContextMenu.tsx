// EnhancedChartContextMenu.tsx - Updated context menu component
import React, { useEffect, useRef } from "react";
import { 
  Calendar, 
  DollarSign, 
  Target, 
  Clock, 
  TrendingUp, 
  BarChart3, 
  Grid3X3,
  Activity,
  Zap,
  Settings,
  Repeat,
  Eye,
  EyeOff
} from "lucide-react";

// Order type configurations with their parameters
const ORDER_TYPE_CONFIGS = {
  TWAP: {
    name: "TWAP",
    icon: Clock,
    params: {
      price: ["maxPrice"],
      time: ["startDate", "endDate"],
      other: ["interval"]
    }
  },
  Range: {
    name: "Range", 
    icon: BarChart3,
    params: {
      price: ["startPrice", "endPrice"],
      time: ["expiry"],
      other: ["stepPct"]
    }
  },
  Iceberg: {
    name: "Iceberg",
    icon: Target,
    params: {
      price: ["startPrice", "endPrice"],
      time: ["expiry"],
      other: ["steps"]
    }
  },
  StopLimit: {
    name: "Stop Limit",
    icon: Settings,
    params: {
      price: ["stopPrice", "limitPrice"],
      time: ["expiry"],
      other: []
    }
  },
  ChaseLimit: {
    name: "Chase Limit",
    icon: TrendingUp,
    params: {
      price: ["maxPrice"],
      time: ["expiry"],
      other: ["distancePct"]
    }
  },
  DCA: {
    name: "DCA",
    icon: Repeat,
    params: {
      price: ["maxPrice"],
      time: ["startDate"],
      other: ["interval"]
    }
  },
  GridMarketMaking: {
    name: "Grid",
    icon: Grid3X3,
    params: {
      price: ["startPrice", "endPrice"],
      time: [],
      other: ["stepPct"]
    }
  },
  MomentumReversal: {
    name: "Momentum",
    icon: Activity,
    params: {
      price: [],
      time: [],
      other: []
    }
  },
  RangeBreakout: {
    name: "Breakout", 
    icon: Zap,
    params: {
      price: [],
      time: [],
      other: []
    }
  }
};

interface EnhancedChartContextMenuProps {
  x: number;
  y: number;
  price: number;
  time: number;
  orderType: string;
  onClose: () => void;
  onSetParameter: (param: string, value: any) => void;
  onToggleOverlays?: (visible: boolean) => void;
  overlaysVisible?: boolean;
}

export function EnhancedChartContextMenu({ 
  x, 
  y, 
  price, 
  time, 
  orderType, 
  onClose, 
  onSetParameter,
  onToggleOverlays,
  overlaysVisible = true
}: EnhancedChartContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const currentTime = Date.now() / 1000;
  const isInPast = time < currentTime;
  
  // Get configuration for current order type
  const orderConfig = ORDER_TYPE_CONFIGS[orderType as keyof typeof ORDER_TYPE_CONFIGS];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Add slight delay to prevent immediate closing
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleSetPrice = (paramType: string) => {
    onSetParameter(paramType, price.toFixed(6));
    onClose();
  };

  const handleSetTime = (paramType: string) => {
    if (paramType === 'expiry') {
      // For expiry, set days from now
      const daysFromNow = Math.max(1, Math.ceil((time - currentTime) / (24 * 60 * 60)));
      onSetParameter(paramType, daysFromNow.toString());
    } else {
      // For date fields, use ISO string
      const date = new Date(time * 1000);
      const isoString = date.toISOString().slice(0, 16);
      onSetParameter(paramType, isoString);
    }
    onClose();
  };

  const handleSetPriceAndTime = (priceParam: string, timeParam: string) => {
    handleSetPrice(priceParam);
    handleSetTime(timeParam);
  };

  // Generate parameter labels
  const getParamLabel = (param: string): string => {
    const labels: Record<string, string> = {
      startPrice: "Start Price",
      endPrice: "End Price", 
      stopPrice: "Stop Price",
      limitPrice: "Limit Price",
      maxPrice: "Max Price",
      startDate: "Start Time",
      endDate: "End Time",
      expiry: "Expiry"
    };
    return labels[param] || param;
  };

  if (!orderConfig) {
    return null;
  }

  // Build menu items
  const menuItems = [];

  // Overlay toggle (first item if available)
  if (onToggleOverlays) {
    menuItems.push({
      label: `${overlaysVisible ? 'Hide' : 'Show'} Order Levels`,
      icon: overlaysVisible ? EyeOff : Eye,
      action: () => {
        onToggleOverlays(!overlaysVisible);
        onClose();
      },
      disabled: false,
      group: 'overlay',
      special: true
    });
  }
  
  // Price parameters
  orderConfig.params.price.forEach(param => {
    menuItems.push({
      label: `Set ${getParamLabel(param)}`,
      icon: DollarSign,
      action: () => handleSetPrice(param),
      disabled: false,
      group: 'price'
    });
  });

  // Time parameters (disabled if in past)
  if (!isInPast) {
    orderConfig.params.time.forEach(param => {
      menuItems.push({
        label: `Set ${getParamLabel(param)}`,
        icon: Calendar,
        action: () => handleSetTime(param),
        disabled: false,
        group: 'time'
      });
    });
  }

  // Combined actions for complex order types
  if (!isInPast && orderType === 'Iceberg') {
    if (orderConfig.params.price.includes('startPrice') && orderConfig.params.time.includes('expiry')) {
      menuItems.push({
        label: 'Set Start Price & Expiry',
        icon: Target,
        action: () => handleSetPriceAndTime('startPrice', 'expiry'),
        disabled: false,
        group: 'combined'
      });
    }
    
    if (orderConfig.params.price.includes('endPrice') && orderConfig.params.time.includes('expiry')) {
      menuItems.push({
        label: 'Set End Price & Expiry',
        icon: Target,
        action: () => handleSetPriceAndTime('endPrice', 'expiry'),
        disabled: false,
        group: 'combined'
      });
    }
  }

  if (menuItems.length === 0) {
    return null;
  }

  // Calculate menu position to keep it on screen
  const menuWidth = 220;
  const menuHeight = Math.min(400, 60 + (menuItems.length * 40) + 40); // Approximate height
  
  let adjustedX = x;
  let adjustedY = y;
  
  // Adjust X position if menu would go off right edge
  if (x + menuWidth > window.innerWidth) {
    adjustedX = x - menuWidth;
  }
  
  // Adjust Y position if menu would go off bottom edge
  if (y + menuHeight > window.innerHeight) {
    adjustedY = Math.max(10, y - menuHeight);
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-black/95 backdrop-blur-xl border border-primary/50 rounded-lg shadow-2xl py-2 min-w-[220px] max-w-[280px]"
      style={{ left: adjustedX, top: adjustedY }}
      data-context-menu
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-primary/30">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <orderConfig.icon className="w-4 h-4" />
          {orderConfig.name} Order
        </div>
        <div className="text-xs text-slate-400 mt-1">
          <div className="flex items-center justify-between">
            <span>${price.toFixed(6)}</span>
            <span className="text-slate-500">•</span>
            <span>{new Date(time * 1000).toLocaleTimeString()}</span>
          </div>
          <div className="text-center text-slate-500 mt-1">
            {new Date(time * 1000).toLocaleDateString()}
          </div>
        </div>
      </div>
      
      {/* Menu items */}
      {menuItems.map((item, index) => {
        const IconComponent = item.icon;
        const isOverlayToggle = item.group === 'overlay';
        
        return (
          <div key={index}>
            {/* Add separator before non-overlay items */}
            {index > 0 && !isOverlayToggle && menuItems[index-1].group === 'overlay' && (
              <div className="border-t border-primary/30 my-1" />
            )}
            
            <button
              onClick={item.action}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors duration-200 ${
                item.disabled 
                  ? 'opacity-50 cursor-not-allowed text-slate-500' 
                  : isOverlayToggle
                    ? 'text-white hover:bg-blue-500/20 hover:text-blue-300'
                    : 'text-white hover:bg-primary/20 hover:text-primary'
              }`}
            >
              <IconComponent className={`w-4 h-4 flex-shrink-0 ${
                isOverlayToggle ? 'text-blue-400' : 'text-primary'
              }`} />
              <span className="text-left">{item.label}</span>
            </button>
          </div>
        );
      })}
      
      {/* Footer for past time warning */}
      {isInPast && orderConfig.params.time.length > 0 && (
        <div className="px-3 py-2 border-t border-primary/30">
          <div className="text-xs text-yellow-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Time options disabled (past date)
          </div>
        </div>
      )}
      
      {/* Footer with current time reference */}
      <div className="px-3 py-1 border-t border-primary/30 mt-1">
        <div className="text-xs text-slate-500">
          Current: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}