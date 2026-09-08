import { useState } from 'react';
import { Alert, Box, TextField, Typography } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

import { BrandButton, CodePre, DraftCard } from '../../theme/styled';

const SAMPLE_DRAFT = `Rule 1: months 1–12
  IF product = "TERM10" THEN commission = premium × 0.05
Rule 2: months 13–24
  IF product = "TERM10" THEN commission = premium × 0.02`;

const MethodologiesStep = () => {
  const [prompt, setPrompt] = useState('');
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Describe a commission methodology in plain English. AI will draft the
        calculation logic — review before saving.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder='Example: "Pay 5% of premium for months 1–12, then 2% for months 13–24 for product TERM10."'
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <BrandButton
          variant="contained"
          startIcon={<AutoAwesomeRoundedIcon />}
          disabled={!prompt.trim()}
          onClick={() => setDraft(SAMPLE_DRAFT)}
        >
          Generate Draft
        </BrandButton>
      </Box>

      {draft ? (
        <DraftCard variant="outlined">
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ display: 'block', mb: 1 }}
          >
            Generated draft
          </Typography>
          <CodePre>{draft}</CodePre>
        </DraftCard>
      ) : (
        <Alert severity="info" variant="outlined">
          No draft yet. Enter a methodology and click{' '}
          <strong>Generate Draft</strong>.
        </Alert>
      )}
    </Box>
  );
};

export default MethodologiesStep;
