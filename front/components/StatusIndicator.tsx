// @ts-nocheck
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import type { ApiResponse, Service } from '@common/types';
import { ServiceStatus } from '@common/types';
import { THEME } from '@common/constants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface StatusIndicatorProps {
  className?: string;
}

/**
 * StatusIndicator displays a small colored bullet that indicates overall API health.
 * On hover, shows a tooltip with detailed service statuses.
 */
export default function StatusIndicator({ className = '' }: StatusIndicatorProps) {

  // Fetch service statuses from API
  const { data, error } = useSWR<ApiResponse<Service[]>>('/api/status', fetcher, {
    refreshInterval: 10000 // Refresh every 10 seconds
  });

  const services = data?.data || [];
  
  // Calculate overall status based on all services
  const getOverallStatus = () => {
    if (error || !data) return { upCount: 0, totalCount: 0, latency: 0 };
    
    const upServices = services.filter(s => s.status === ServiceStatus.UP);
    const avgLatency = upServices.length > 0 
      ? upServices.reduce((sum, s) => sum + (s.latencyMs || 0), 0) / upServices.length
      : 0;
    
    return { 
      upCount: upServices.length, 
      totalCount: services.length, 
      latency: avgLatency 
    };
  };

  const { upCount, totalCount, latency } = getOverallStatus();

  /**
   * Gets the background color based on service count ratio
   */
  const getStatusBulletColor = (upCount: number, totalCount: number) => {
    if (totalCount === 0) return THEME.error;
    
    const ratio = upCount / totalCount;
    
    if (ratio === 1) return THEME.success; // All services up - green
    if (ratio >= 0.5) return THEME.warning; // Half or more up - orange
    return THEME.error; // Less than half up - red
  };

  /**
   * Gets the status label for a service
   */
  const getStatusLabel = (status: ServiceStatus) => {
    return status === ServiceStatus.UNKNOWN ? 'N/A' : status;
  };

  /**
   * Formats latency for display
   */
  const formatLatency = (service: Service) => {
    if (service.status !== ServiceStatus.UP || !service.latencyMs) return 'N/A';
    const ms = service.latencyMs;
    if (ms >= 1000) {
      const secs = Math.floor(ms / 1000);
      return `${secs}s+`;
    }
    return `${ms}ms`;
  };

  /**
   * Gets text color based on service count ratio
   */
  const getStatusTextColor = (upCount: number, totalCount: number) => {
    if (totalCount === 0) return THEME.error;
    
    const ratio = upCount / totalCount;
    
    if (ratio === 1) return THEME.success; // All services up - green
    if (ratio >= 0.5) return THEME.warning; // Half or more up - orange
    return THEME.error; // Less than half up - red
  };

  /**
   * Gets latency color
   */
  const getLatencyColor = (service: Service) => {
    if (service.status !== ServiceStatus.UP || !service.latencyMs) {
      return 'rgb(148, 163, 184)'; // slate-400
    }
    const ms = service.latencyMs;
    if (ms <= 250) return THEME.success;
    if (ms <= 500) return THEME.secondary;
    if (ms <= 1000) return THEME.warning;
    return THEME.error;
  };

  const bulletColor = getStatusBulletColor(upCount, totalCount);
  const statusText = `${upCount}/${totalCount}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-2 cursor-pointer ${className}`}>
          {/* Status bullet */}
          <div 
            className="w-2 h-2 rounded-full transition-all duration-300 hover:scale-125"
            style={{ backgroundColor: bulletColor }}
          />
          {/* Status text */}
          <span 
            className="text-xs font-mono font-medium"
            style={{ color: getStatusTextColor(upCount, totalCount) }}
          >
            {statusText}
          </span>
        </div>
      </TooltipTrigger>
      
      <TooltipContent 
        side="top" 
        className="w-80 max-w-none bg-black/95 backdrop-blur-xl border-slate-700/50 text-slate-200 p-0"
        sideOffset={8}
      >
        <div className="p-3 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-teal-400">System Status</h3>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          {/* Internal Services */}
          <div className="p-2 bg-slate-800/30">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
              Internal Services
            </div>
          </div>
          
          {services
            .filter(s => s.pingUrl?.startsWith('internal:'))
            .map((service) => (
              <div key={service.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800/20">
                <span className="text-sm text-slate-200">{service.name}</span>
                <div className="flex items-center gap-2">
                  <span 
                    className="text-xs font-mono"
                    style={{ color: service.status === ServiceStatus.UP ? THEME.success : service.status === ServiceStatus.DOWN ? THEME.error : THEME.warning }}
                  >
                    {getStatusLabel(service.status)}
                  </span>
                  {service.status === ServiceStatus.UP && (
                    <>
                      <span className="text-xs text-slate-500">•</span>
                      <span 
                        className="text-xs font-mono"
                        style={{ color: getLatencyColor(service) }}
                      >
                        {formatLatency(service)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          
          {/* External Services */}
          {services.filter(s => !s.pingUrl?.startsWith('internal:')).length > 0 && (
            <>
              <div className="p-2 bg-slate-800/30 border-t border-slate-700/50">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                  External Services
                </div>
              </div>
              
              {services
                .filter(s => !s.pingUrl?.startsWith('internal:'))
                .map((service) => (
                  <div key={service.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-800/20">
                    <span className="text-sm text-slate-200">{service.name}</span>
                    <div className="flex items-center gap-2">
                      <span 
                        className="text-xs font-mono"
                        style={{ color: service.status === ServiceStatus.UP ? THEME.success : service.status === ServiceStatus.DOWN ? THEME.error : THEME.warning }}
                      >
                        {getStatusLabel(service.status)}
                      </span>
                      {service.status === ServiceStatus.UP && (
                        <>
                          <span className="text-xs text-slate-500">•</span>
                          <span 
                            className="text-xs font-mono"
                            style={{ color: getLatencyColor(service) }}
                          >
                            {formatLatency(service)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
        
        <div className="p-2 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Updated: {new Date().toLocaleTimeString()}</span>
            <span>{services.filter(s => s.status === ServiceStatus.UP).length}/{services.length} UP</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}