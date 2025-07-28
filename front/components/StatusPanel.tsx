// @ts-nocheck
import { Paper, Typography, Box, Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Chip, Divider } from '@mui/material';
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import type { ApiResponse, Service } from '@common/types';
import { ServiceStatus } from '@common/types';
import InfoTooltip from './common/InfoTooltip';
import { THEME } from '@common/constants';

/**
 * StatusPanel displays the status of internal and external services.
 * Fetches service statuses from the API and shows their health, latency, and last checked time.
 */
export default function StatusPanel() {
  // Fetch service statuses from API with shorter cache time to update more frequently
  const { data, error } = useSWR<ApiResponse<Service[]>>('/api/status', fetcher, {
    refreshInterval: 10000 // Refresh every 10 seconds
  });

  // Error state
  if (error) {
    return (
      <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="error">Failed to load service statuses.</Typography>
      </Paper>
    );
  }

  // Loading state
  if (!data) {
    return (
      <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography>Loading service statuses...</Typography>
      </Paper>
    );
  }

  const services = data.data;
  // Split into internal and external categories
  const internalServices = services.filter(s => s.pingUrl?.startsWith('internal:'));
  const externalServices = services.filter(s => !s.pingUrl?.startsWith('internal:'));

  /**
   * Formats the latency for display.
   * @param service - The service object.
   * @returns The formatted latency string.
   */
  const formatLatency = (service) => {
    if (service.status !== ServiceStatus.UP || !service.latencyMs) return 'N/A';
    const ms = service.latencyMs;
    if (ms >= 1000) {
      const secs = Math.floor(ms / 1000);
      return `${secs}s+`;
    }
    return `${ms}ms`;
  };

  /**
   * Formats a timestamp for display.
   * @param timestamp - The timestamp to format.
   * @returns The formatted time string.
   */
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  /**
   * Gets the status label for a service.
   * @param status - The service status.
   * @returns The status label string.
   */
  const getStatusLabel = (status) => {
    return status === ServiceStatus.UNKNOWN ? 'N/A' : status;
  };

  /**
   * Gets the background color for a status chip.
   * @param status - The service status.
   * @returns The background color string.
   */
  const getStatusBgColor = (status) => {
    // Error background for DOWN, default semi-transparent overlay for visibility
    if (status === ServiceStatus.DOWN) return THEME.error;
    return THEME.background.overlay10;
  };

  /**
   * Gets the text color for a status chip.
   * @param status - The service status.
   * @returns The text color string.
   */
  const getStatusTextColor = (status) => {
    // Green text for UP, theme text primary for DOWN, muted grey for others
    if (status === ServiceStatus.UP) return THEME.success;
    if (status === ServiceStatus.DOWN) return THEME.text.primary;
    return 'var(--muted-foreground)';
  };

  /**
   * Gets the color for latency text based on thresholds.
   * @param service - The service object.
   * @returns The color string.
   */
  const getLatencyColor = (service) => {
    // Use muted grey for non-UP statuses or missing latency
    if (service.status !== ServiceStatus.UP || !service.latencyMs) {
      return 'var(--muted-foreground)';
    }
    const ms = service.latencyMs;
    // Success for fast pings
    if (ms <= 250) return THEME.success;
    // Warning for moderate latency
    if (ms <= 500) return THEME.secondary;
    // Higher warning for slow latency
    if (ms <= 1000) return THEME.warning;
    // Error color for very slow
    return THEME.error;
  };

  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        width: '100%',
        p: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <TableContainer sx={{ maxHeight: '100%', width: '100%' }}>
        <Table size="small" stickyHeader className="table" sx={{ width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell align="left"
                sx={{
                  py: 1,
                  px: 1.5,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'left'
                }}
              >
                Service
              </TableCell>
              <TableCell
                sx={{
                  py: 1,
                  px: 1.5,
                  width: '1%',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'center',
                }}
              >
                Status
              </TableCell>
              <TableCell align="right"
                sx={{
                  py: 1,
                  px: 1.5,
                  fontWeight: 500,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted-foreground)',
                  letterSpacing: '0.5px',
                  textAlign: 'right'
                }}
              >
                At
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Internal services group */}
            <TableRow>
              <TableCell colSpan={3} sx={{ py: 1, px: 1.5, backgroundColor: THEME.background.overlay05 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: THEME.font.size.xs, textTransform: 'uppercase', color: THEME.text.secondary }}>
                    Internal Services
                  </Typography>
                  <InfoTooltip title="Internal services: API Server, Collector, Strategy, Next Server" placement="right" />
                </Box>
              </TableCell>
            </TableRow>
            {internalServices.map((service) => (
              <TableRow key={service.id}>
                <TableCell align="left" sx={{ py: 0.5, px: 1.5 }}>
                  {service.name}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1.5, textAlign: 'center' }}>
                  <Chip
                    size="small"
                    label={
                      service.status === ServiceStatus.UNKNOWN || service.status === ServiceStatus.DOWN ? (
                        <Typography variant="caption" sx={{ color: getStatusTextColor(service.status), fontFamily: THEME.font.mono }}>
                          {getStatusLabel(service.status)}
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: getStatusTextColor(service.status), fontFamily: THEME.font.mono }}>
                            {getStatusLabel(service.status)}
                          </Typography>
                          <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'var(--muted-foreground)' }} />
                          <Typography variant="caption" sx={{ color: getLatencyColor(service), fontFamily: THEME.font.mono }}>
                            {formatLatency(service)}
                          </Typography>
                        </Box>
                      )
                    }
                    sx={{
                      backgroundColor: getStatusBgColor(service.status),
                      height: 'auto',
                      px: 1,
                      '& .MuiChip-label': { p: 0 },
                    }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ py: 0.5, px: 1.5, textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ fontFamily: THEME.font.mono, color: 'var(--muted-foreground)' }}>
                    {formatTimestamp(service.checkedAt)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
            {/* External APIs group */}
            <TableRow>
              <TableCell colSpan={3} sx={{ py: 1, px: 1.5, backgroundColor: THEME.background.overlay05 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontSize: THEME.font.size.xs, textTransform: 'uppercase', color: THEME.text.secondary }}>
                    External Services
                  </Typography>
                  <InfoTooltip title="External Services: Prediction Market APIs, Exchanges APIs etc." placement="right" />
                </Box>
              </TableCell>
            </TableRow>
            {externalServices.map((service) => (
              <TableRow key={service.id}>
                <TableCell align="left" sx={{ py: 0.5, px: 1.5 }}>
                  {service.name}
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1.5, textAlign: 'center' }}>
                  <Chip
                    size="small"
                    label={
                      service.status === ServiceStatus.UNKNOWN || service.status === ServiceStatus.DOWN ? (
                        <Typography variant="caption" sx={{ color: getStatusTextColor(service.status), fontFamily: THEME.font.mono }}>
                          {getStatusLabel(service.status)}
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ color: getStatusTextColor(service.status), fontFamily: THEME.font.mono }}>
                            {getStatusLabel(service.status)}
                          </Typography>
                          <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'var(--muted-foreground)' }} />
                          <Typography variant="caption" sx={{ color: getLatencyColor(service), fontFamily: THEME.font.mono }}>
                            {formatLatency(service)}
                          </Typography>
                        </Box>
                      )
                    }
                    sx={{
                      backgroundColor: getStatusBgColor(service.status),
                      height: 'auto',
                      px: 1,
                      '& .MuiChip-label': { p: 0 },
                    }}
                  />
                </TableCell>
                <TableCell align="right" sx={{ py: 0.5, px: 1.5, textAlign: 'right' }}>
                  <Typography variant="caption" sx={{ fontFamily: THEME.font.mono, color: 'var(--muted-foreground)' }}>
                    {formatTimestamp(service.checkedAt)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

