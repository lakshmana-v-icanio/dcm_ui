import { Alert, Box, Typography } from '@mui/material';

const MethodologiesTab = () => (
  <Box>
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Methodologies
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Ordered calculation steps that consume variables and rate tables.
    </Typography>
    <Alert severity="info" sx={{ borderRadius: 2 }}>
      Methodology editor coming soon.
    </Alert>
  </Box>
);

export default MethodologiesTab;
