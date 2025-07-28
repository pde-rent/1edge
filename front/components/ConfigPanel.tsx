// @ts-nocheck
import { Paper, Typography, Box, Button, Fab } from '@mui/material';
import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { fetcher } from '../utils/fetcher';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { THEME } from '@common/constants';
import { betbotTheme } from '../themes/codemirror/betbot';
import PanelHeader from './common/PanelHeader';
import SaveIcon from '@mui/icons-material/Save';

/**
 * ConfigPanel displays and allows editing of the global configuration for services.
 * Uses CodeMirror for JSON editing and supports save/load with debounce and error handling.
 */
export default function ConfigPanel() {
  const { data, error, mutate } = useSWR('/api/config', fetcher);
  const [configText, setConfigText] = useState('');
  const [originalConfig, setOriginalConfig] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasChanged, setHasChanged] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (data?.success && data.data) {
      try {
        const fetchedJson = JSON.stringify(data.data, null, 2);
        setConfigText(fetchedJson);
        setOriginalConfig(fetchedJson);
        setHasChanged(false);
      } catch (e) {
        setConfigText(JSON.stringify(data.data, null, 2));
        setOriginalConfig(JSON.stringify(data.data, null, 2));
      }
    }
  }, [data]);

  /**
   * Checks for changes between the current and original config text.
   * @param newText - The new config text.
   */
  const checkForChanges = (newText: string) => {
    try {
      // Only compare if both are valid JSON
      const currentJson = JSON.parse(newText);
      const originalJson = JSON.parse(originalConfig);

      const currentStr = JSON.stringify(currentJson);
      const originalStr = JSON.stringify(originalJson);

      setHasChanged(currentStr !== originalStr);
    } catch (e) {
      // If invalid JSON, just check string equality
      setHasChanged(newText !== originalConfig);
    }
  };

  /**
   * Handles changes to the config text, with debounce for change detection.
   * @param value - The new config text value.
   */
  const handleConfigChange = (value: string) => {
    setConfigText(value);

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounce timer for 2 seconds
    debounceTimerRef.current = setTimeout(() => {
      checkForChanges(value);
    }, 1000);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Handles saving the config to the server.
   */
  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // Validate JSON
      const parsedJson = JSON.parse(configText);

      // Use shared fetcher for POST
      const result = await fetcher('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedJson),
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save config');
      }

      // Refresh the data
      mutate();
      setHasChanged(false);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (error) return (
    <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 0, display: 'flex', flexDirection: 'column' }}>
      <PanelHeader title="Configuration" tooltip="Global configuration for services: Collector (feeds definition and aggregation strategies), Strategy (parameters), StatusChecker (targets and frequency)" />
      <Box sx={{ p: 2, flex: 1 }}>
        <Typography color="error">Error loading config: {error.message}</Typography>
      </Box>
    </Paper>
  );

  if (!data && !error) return (
    <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 0, display: 'flex', flexDirection: 'column' }}>
      <PanelHeader title="Configuration" tooltip="Global configuration for services: Collector (feeds definition and aggregation strategies), Strategy (parameters), StatusChecker (targets and frequency)" />
      <Box sx={{ p: 2, flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Typography color="text.secondary">Loading config...</Typography>
      </Box>
    </Paper>
  );

  if (data && !data.success) return (
    <Paper elevation={1} sx={{ height: '100%', width: '100%', p: 0, display: 'flex', flexDirection: 'column' }}>
      <PanelHeader title="Configuration" tooltip="Global configuration for services: Collector (feeds definition and aggregation strategies), Strategy (parameters), StatusChecker (targets and frequency)" />
      <Box sx={{ p: 2, flex: 1 }}>
        <Typography color="error">Error: {data.error}</Typography>
      </Box>
    </Paper>
  );

  return (
    <Paper
      elevation={1}
      sx={{
        height: '100%',
        width: '100%',
        p: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}
    >
      <PanelHeader title="Configuration" tooltip="Global configuration for services: Collector (feeds definition and aggregation strategies), Strategy (parameters), StatusChecker (targets and frequency)" />

      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: THEME.background.paper,
          position: 'relative'
        }}
      >
        <div style={{
          flex: 1,
          backgroundColor: THEME.background.paper,
          overflow: 'auto',
          border: 'none'
        }}>
          <CodeMirror
            value={configText}
            height="100%"
            width="100%"
            extensions={[json(), ...betbotTheme]}
            onChange={handleConfigChange}
            style={{
              backgroundColor: THEME.background.paper,
              height: '100%',
              fontSize: '12px'
            }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              highlightActiveLineGutter: true
            }}
          />
        </div>

        <Button
          color="primary"
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || !hasChanged}
          startIcon={<SaveIcon fontSize="small" />}
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            backgroundColor: hasChanged ? THEME.primary : THEME.grey[500],
            '&:hover': {
              backgroundColor: hasChanged ? `${THEME.primary}cc` : THEME.grey[500]
            },
            '&.Mui-disabled': {
              backgroundColor: THEME.grey[500],
              color: THEME.text.secondary
            },
            zIndex: 10,
            px: 2,
            py: 0.75,
            borderRadius: '4px',
            textTransform: 'uppercase',
            fontWeight: 500
          }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>

        {saveError && (
          <Box sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 1,
            backgroundColor: THEME.background.overlayDark,
            borderTop: `1px solid ${THEME.error}4D`
          }}>
            <Typography variant="caption" color="error">
              {saveError}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
